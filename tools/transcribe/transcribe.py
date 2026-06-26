#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "mlx-whisper>=0.4.0",
#   "yt-dlp>=2024.0.0",
# ]
# ///
"""
Transcribe a YouTube video (or a local audio/video file) to text using a local
Whisper model running on Apple Silicon via MLX (Metal GPU).

Optimised for long-form audio (1-2 hour sermons / talks). Accuracy first, with
a faster `large-v3-turbo` option when you want speed.

Usage (recommended, no setup needed):
    uv run transcribe.py "https://www.youtube.com/watch?v=XXXX"

Or with a classic venv:
    pip install -r requirements.txt
    python transcribe.py "https://www.youtube.com/watch?v=XXXX"

Examples:
    # Most accurate (default): whisper large-v3 on the GPU
    uv run transcribe.py "<url>"

    # Faster, slightly less accurate
    uv run transcribe.py "<url>" --model large-v3-turbo

    # Force English + give the model a vocabulary hint for proper nouns
    uv run transcribe.py "<url>" --language en \
        --prompt "A Christian sermon. Names: Habakkuk, Nebuchadnezzar, Melchizedek."

    # Transcribe a file you already have
    uv run transcribe.py ./talk.m4a
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Model registry: short name -> Hugging Face repo (auto-downloaded & cached).
# fp16 weights are used for best accuracy. The 4-bit variants are smaller/faster
# but a touch less accurate -- exposed for the curious.
# ---------------------------------------------------------------------------
MODELS = {
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "large-v3-q4": "mlx-community/whisper-large-v3-mlx-4bit",
    "turbo-q4": "mlx-community/whisper-large-v3-turbo-q4",
    "medium": "mlx-community/whisper-medium-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "tiny": "mlx-community/whisper-tiny-mlx",  # smoke-testing only
}
DEFAULT_MODEL = "large-v3"

URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def log(msg: str) -> None:
    print(f"  {msg}", flush=True)


def die(msg: str) -> "NoReturn":  # noqa: F821
    print(f"\nERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def require_binary(name: str, hint: str) -> None:
    if shutil.which(name) is None:
        die(f"`{name}` not found on PATH. {hint}")


def sanitize(name: str) -> str:
    """Make a string safe to use as a filename."""
    name = re.sub(r"[\\/:*?\"<>|]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return (name or "transcript")[:150]


def fmt_duration(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"


# ---------------------------------------------------------------------------
# Step 1: get a 16 kHz mono WAV (the canonical Whisper input) from a URL or file
# ---------------------------------------------------------------------------
def download_audio(url: str, workdir: Path) -> tuple[Path, str]:
    """Download best audio from a URL with yt-dlp. Returns (audio_path, title)."""
    import yt_dlp

    out_tmpl = str(workdir / "source.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 5,
        "fragment_retries": 10,
        "progress_hooks": [_progress_hook],
    }
    log("Downloading audio with yt-dlp ...")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title") or info.get("id") or "transcript"
        dur = info.get("duration")
        if dur:
            log(f"Source: {title!r}  ({fmt_duration(dur)})")

    downloaded = sorted(workdir.glob("source.*"))
    if not downloaded:
        die("yt-dlp finished but no audio file was produced.")
    return downloaded[0], title


_last_pct = {"v": -1}


def _progress_hook(d: dict) -> None:
    if d.get("status") != "downloading":
        return
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if not total:
        return
    pct = int(d.get("downloaded_bytes", 0) * 100 / total)
    if pct >= _last_pct["v"] + 10:  # throttle: every ~10%
        _last_pct["v"] = pct
        log(f"  ... {pct}%")


def to_wav(src: Path, workdir: Path) -> Path:
    """Convert any audio/video file to 16 kHz mono PCM WAV via ffmpeg."""
    wav = workdir / "audio16k.wav"
    log("Converting to 16 kHz mono WAV ...")
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(wav),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not wav.exists():
        die(f"ffmpeg conversion failed:\n{proc.stderr.strip()}")
    return wav


# ---------------------------------------------------------------------------
# Step 2: transcribe with MLX Whisper (Apple Silicon GPU)
# ---------------------------------------------------------------------------
def transcribe(wav: Path, repo: str, args: argparse.Namespace) -> dict:
    import mlx_whisper

    decode_kwargs = dict(
        path_or_hf_repo=repo,
        verbose=False if args.quiet else None,  # None => tqdm progress bar
        word_timestamps=args.word_timestamps,
        # Temperature fallback: retry harder segments at higher temperatures.
        temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
        # Carry context across 30s windows -> better proper-noun consistency.
        condition_on_previous_text=not args.no_context,
        compression_ratio_threshold=2.4,
        logprob_threshold=-1.0,
        no_speech_threshold=0.6,
    )
    if args.language:
        decode_kwargs["language"] = args.language
    if args.prompt:
        decode_kwargs["initial_prompt"] = args.prompt

    log(f"Transcribing with {repo} ...")
    log("(first run downloads the model to ~/.cache/huggingface, then it's cached)")
    return mlx_whisper.transcribe(str(wav), **decode_kwargs)


# ---------------------------------------------------------------------------
# Step 3: write outputs (.txt / .srt / .vtt / .json)
# ---------------------------------------------------------------------------
def _ts(seconds: float, sep: str) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def write_outputs(result: dict, stem: Path, formats: list[str]) -> list[Path]:
    import json

    segments = result.get("segments", [])
    written = []

    if "txt" in formats:
        p = stem.with_suffix(".txt")
        p.write_text((result.get("text") or "").strip() + "\n", encoding="utf-8")
        written.append(p)

    if "srt" in formats:
        p = stem.with_suffix(".srt")
        lines = []
        for i, seg in enumerate(segments, 1):
            lines.append(str(i))
            lines.append(f"{_ts(seg['start'], ',')} --> {_ts(seg['end'], ',')}")
            lines.append(seg["text"].strip())
            lines.append("")
        p.write_text("\n".join(lines), encoding="utf-8")
        written.append(p)

    if "vtt" in formats:
        p = stem.with_suffix(".vtt")
        lines = ["WEBVTT", ""]
        for seg in segments:
            lines.append(f"{_ts(seg['start'], '.')} --> {_ts(seg['end'], '.')}")
            lines.append(seg["text"].strip())
            lines.append("")
        p.write_text("\n".join(lines), encoding="utf-8")
        written.append(p)

    if "json" in formats:
        p = stem.with_suffix(".json")
        p.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(p)

    return written


# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe a YouTube URL (or local file) with local MLX Whisper.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("source", help="YouTube URL, or path to a local audio/video file")
    parser.add_argument(
        "-m", "--model", default=DEFAULT_MODEL,
        help=f"Model: {', '.join(MODELS)} or any HF repo id (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "-o", "--output-dir", default=str(Path(__file__).parent / "transcripts"),
        help="Where to write transcripts (default: ./transcripts)",
    )
    parser.add_argument(
        "-l", "--language", default=None,
        help="Force a language code (e.g. 'en'). Default: auto-detect.",
    )
    parser.add_argument(
        "-p", "--prompt", default=None,
        help="Initial prompt to bias spelling/punctuation (proper nouns, names).",
    )
    parser.add_argument(
        "-f", "--formats", default="txt,srt,vtt,json",
        help="Comma-separated output formats (default: txt,srt,vtt,json)",
    )
    parser.add_argument(
        "--word-timestamps", action="store_true",
        help="Compute per-word timestamps (slower; tighter subtitle timing).",
    )
    parser.add_argument(
        "--no-context", action="store_true",
        help="Don't condition on previous text (avoids rare repetition loops).",
    )
    parser.add_argument(
        "--save-audio", action="store_true",
        help="Also keep the downloaded source audio next to the transcript.",
    )
    parser.add_argument("--quiet", action="store_true", help="Less logging.")
    args = parser.parse_args()

    require_binary("ffmpeg", "Install with: brew install ffmpeg")

    repo = MODELS.get(args.model, args.model)  # allow raw HF repo ids too
    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    out_dir = Path(args.output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Work in a scratch dir we clean up at the end.
    workdir = out_dir / ".work"
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)

    t0 = time.time()
    try:
        is_url = bool(URL_RE.match(args.source))
        if is_url:
            audio_src, title = download_audio(args.source, workdir)
        else:
            src_path = Path(args.source).expanduser()
            if not src_path.exists():
                die(f"Local file not found: {src_path}")
            audio_src, title = src_path, src_path.stem

        wav = to_wav(audio_src, workdir)
        audio_seconds = _wav_duration(wav)

        result = transcribe(wav, repo, args)

        stem = out_dir / sanitize(title)
        written = write_outputs(result, stem, formats)

        if args.save_audio:
            kept = stem.with_suffix(audio_src.suffix)
            shutil.copy2(audio_src, kept)
            written.append(kept)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    elapsed = time.time() - t0
    rtf = (audio_seconds / elapsed) if elapsed else 0
    print()
    log(f"Done in {fmt_duration(elapsed)} "
        f"({rtf:.1f}x realtime for {fmt_duration(audio_seconds)} of audio)")
    detected = result.get("language")
    if detected:
        log(f"Language: {detected}")
    log("Wrote:")
    for p in written:
        print(f"      {p}")


def _wav_duration(wav: Path) -> float:
    """Duration of a 16-bit mono 16 kHz PCM WAV, read from its header."""
    import wave
    try:
        with wave.open(str(wav), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        return 0.0


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        die("Interrupted.")
