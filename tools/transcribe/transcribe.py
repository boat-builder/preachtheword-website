#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "mlx-whisper>=0.4.0",
#   "yt-dlp>=2024.0.0",
# ]
# ///
"""
Transcribe YouTube videos (or local audio/video files) to text using a local
Whisper model running on Apple Silicon via MLX (Metal GPU).

Optimised for long-form audio (1-2 hour sermons / talks). Accuracy first, with
a faster `large-v3-turbo` option when you want speed. Handles one item or a
whole batch in a single run (the model loads once and is reused).

Usage (recommended, no setup needed):
    uv run transcribe.py "https://www.youtube.com/watch?v=XXXX"

Or with a classic venv:
    pip install -r requirements.txt
    python transcribe.py "https://www.youtube.com/watch?v=XXXX"

Examples:
    # Single video, most accurate (default): whisper large-v3 on the GPU
    uv run transcribe.py "<url>"

    # A batch -- a file with one URL per line (# comments + blanks ignored)
    uv run transcribe.py --batch links.txt

    # ...same thing, since a .txt/.list file is auto-detected as a URL list
    uv run transcribe.py links.txt

    # Several URLs straight on the command line
    uv run transcribe.py "<url1>" "<url2>" "<url3>"

    # Resume an interrupted batch -- skip videos already transcribed
    uv run transcribe.py --batch links.txt --skip-existing

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
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
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
# Extensions we treat as "a list of URLs" when passed as a positional argument.
LIST_EXTS = {".txt", ".list", ".urls"}


class TranscribeError(Exception):
    """A per-item failure that should NOT abort the rest of a batch."""


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


def reset_dir(d: Path) -> None:
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)


# ---------------------------------------------------------------------------
# Input collection: turn CLI args + batch files into an ordered list of targets
# ---------------------------------------------------------------------------
def read_url_list(path: Path) -> list[str]:
    """Read a URL-list file: one entry per line; ignore blanks and # comments."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        die(f"Could not read list file {path}: {e}")
    urls = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls


def looks_like_url_list(path: Path) -> bool:
    """A positional file is a URL list if its extension says so, or its first
    meaningful line is an http(s) URL (so plain `transcribe.py links.txt` works)."""
    if path.suffix.lower() in LIST_EXTS:
        return True
    try:
        with path.open("r", encoding="utf-8") as f:
            for _ in range(20):  # peek a few lines
                line = f.readline()
                if not line:
                    break
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                return bool(URL_RE.match(line))
    except (OSError, UnicodeDecodeError):
        return False  # binary (e.g. an audio file) -> not a list
    return False


def collect_targets(args: argparse.Namespace) -> list[str]:
    """Build the ordered, de-duplicated list of things to transcribe."""
    targets: list[str] = []
    for src in args.sources:
        if URL_RE.match(src):
            targets.append(src)
            continue
        p = Path(src).expanduser()
        if p.is_file() and looks_like_url_list(p):
            targets.extend(read_url_list(p))
        else:
            targets.append(src)  # local media file (validated when processed)
    for batch_file in args.batch or []:
        bf = Path(batch_file).expanduser()
        if not bf.is_file():
            die(f"Batch file not found: {bf}")
        targets.extend(read_url_list(bf))

    # De-duplicate while preserving order.
    seen, deduped = set(), []
    for t in targets:
        if t in seen:
            log(f"(skipping duplicate input: {t})")
            continue
        seen.add(t)
        deduped.append(t)
    return deduped


# ---------------------------------------------------------------------------
# Step 1: get a 16 kHz mono WAV (the canonical Whisper input) from a URL or file
# ---------------------------------------------------------------------------
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


def fetch_title(url: str) -> str:
    """Fetch a video's title without downloading it (for --skip-existing)."""
    import yt_dlp

    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:  # noqa: BLE001 - surface as a per-item failure
        raise TranscribeError(f"Could not read video metadata: {e}") from e
    return info.get("title") or info.get("id") or "transcript"


def build_meta(info: dict, source: str) -> dict:
    """Curate the useful bits of yt-dlp's (huge) info dict for the header."""
    def fmt_date(d):
        if d and len(d) == 8 and d.isdigit():
            return f"{d[:4]}-{d[4:6]}-{d[6:]}"
        return d

    return {
        "title": info.get("title") or info.get("id") or "transcript",
        "url": info.get("webpage_url") or info.get("original_url") or source,
        "video_id": info.get("id"),
        "channel": info.get("channel") or info.get("uploader"),
        "channel_url": info.get("channel_url") or info.get("uploader_url"),
        "upload_date": fmt_date(info.get("upload_date")),
        "duration_seconds": info.get("duration"),
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "categories": info.get("categories") or [],
        "tags": info.get("tags") or [],
        "description": (info.get("description") or "").strip(),
    }


def download_audio(url: str, workdir: Path) -> tuple[Path, dict]:
    """Download best audio from a URL with yt-dlp. Returns (audio_path, meta)."""
    import yt_dlp

    _last_pct["v"] = -1  # reset throttle for this download (matters in a batch)
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
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as e:  # noqa: BLE001 - one bad URL shouldn't kill the batch
        raise TranscribeError(f"Download failed: {e}") from e

    meta = build_meta(info, source=url)
    if meta["duration_seconds"]:
        log(f"Source: {meta['title']!r}  ({fmt_duration(meta['duration_seconds'])})")

    downloaded = sorted(workdir.glob("source.*"))
    if not downloaded:
        raise TranscribeError("yt-dlp finished but no audio file was produced.")
    return downloaded[0], meta


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
        raise TranscribeError(f"ffmpeg conversion failed:\n{proc.stderr.strip()}")
    return wav


# ---------------------------------------------------------------------------
# Step 2: transcribe with MLX Whisper (Apple Silicon GPU)
# ---------------------------------------------------------------------------
def transcribe(wav: Path, repo: str, args: argparse.Namespace) -> dict:
    import mlx_whisper

    # mlx-whisper shows a tqdm progress bar (over the audio) only when
    # verbose is exactly False; True streams each segment's text; None is silent.
    if args.quiet:
        verbose = None
    elif args.verbose:
        verbose = True
    else:
        verbose = False  # default: a live progress bar for long transcriptions

    decode_kwargs = dict(
        path_or_hf_repo=repo,
        verbose=verbose,
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
    # load_model() inside mlx_whisper is LRU-cached, so this only hits disk/network
    # on the first item of a run; later items reuse the in-memory model.
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


def output_paths(stem: Path, formats: list[str]) -> list[Path]:
    return [stem.with_suffix(f".{fmt}") for fmt in formats]


SEP = "=" * 72  # metadata-block separator used at the top of .txt transcripts


def _meta_rows(meta: dict) -> list[tuple[str, str]]:
    """Ordered (label, value) pairs for the header; single-line values only."""
    rows: list[tuple[str, str]] = []

    def add(label: str, value) -> None:
        if value:
            rows.append((label, str(value)))

    add("Title", meta.get("title"))
    add("URL", meta.get("url"))
    add("Source file", meta.get("source_file"))
    channel = meta.get("channel")
    if channel and meta.get("channel_url"):
        channel = f"{channel}  ({meta['channel_url']})"
    add("Channel", channel)
    add("Uploaded", meta.get("upload_date"))
    if meta.get("duration_seconds"):
        add("Duration", fmt_duration(meta["duration_seconds"]))
    add("Video ID", meta.get("video_id"))
    if meta.get("view_count") is not None:
        add("Views", f"{meta['view_count']:,}")
    if meta.get("categories"):
        add("Categories", ", ".join(meta["categories"]))
    if meta.get("tags"):
        tags = ", ".join(meta["tags"])
        add("Tags", tags if len(tags) <= 300 else tags[:297] + "...")
    add("Model", meta.get("model"))
    add("Language", meta.get("language"))
    add("Transcribed", meta.get("transcribed_at"))
    return rows


def format_txt_header(meta: dict) -> str:
    """A human-readable, === delimited metadata block for the .txt transcript."""
    rows = _meta_rows(meta)
    width = max((len(label) for label, _ in rows), default=0)
    lines = [SEP]
    for label, value in rows:
        lines.append(f"{(label + ':').ljust(width + 1)}  {value}")
    desc = meta.get("description")
    if desc:
        lines.append("")
        lines.append("Description:")
        lines.extend(f"  {dline}" for dline in desc.splitlines())
    lines.append(SEP)
    lines.append("")  # blank line between the block and the transcript
    return "\n".join(lines) + "\n"


def format_vtt_note(meta: dict) -> list[str]:
    """A spec-valid WebVTT NOTE block (single-line entries; players ignore it)."""
    # Note: description is intentionally omitted -- a blank line would end the
    # NOTE block early and the description may contain blank lines.
    return ["NOTE"] + [f"{label}: {value}" for label, value in _meta_rows(meta)]


def write_outputs(
    result: dict,
    stem: Path,
    formats: list[str],
    meta: dict,
    include_meta: bool = True,
) -> list[Path]:
    import json

    segments = result.get("segments", [])
    written = []

    if "txt" in formats:
        p = stem.with_suffix(".txt")
        header = format_txt_header(meta) if include_meta else ""
        p.write_text(header + (result.get("text") or "").strip() + "\n", encoding="utf-8")
        written.append(p)

    if "srt" in formats:
        # SRT stays clean -- arbitrary headers break many SRT parsers/players.
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
        if include_meta:
            lines += format_vtt_note(meta) + [""]
        for seg in segments:
            lines.append(f"{_ts(seg['start'], '.')} --> {_ts(seg['end'], '.')}")
            lines.append(seg["text"].strip())
            lines.append("")
        p.write_text("\n".join(lines), encoding="utf-8")
        written.append(p)

    if "json" in formats:
        p = stem.with_suffix(".json")
        payload = {"metadata": meta, **result} if include_meta else result
        p.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(p)

    return written


# ---------------------------------------------------------------------------
# One item, end to end. Raises TranscribeError on failure (batch keeps going).
# ---------------------------------------------------------------------------
def process_one(
    source: str,
    args: argparse.Namespace,
    repo: str,
    formats: list[str],
    out_dir: Path,
    workdir: Path,
    prefix: str,
) -> dict:
    reset_dir(workdir)
    is_url = bool(URL_RE.match(source))

    # Resolve the output stem up front when we can, so --skip-existing can bail
    # before doing expensive work.
    if is_url:
        if args.skip_existing:
            title = fetch_title(source)
            stem = out_dir / sanitize(title)
            if all(p.exists() for p in output_paths(stem, formats)):
                log(f"{prefix}Skipping (already transcribed): {title!r}")
                return {"status": "skipped", "title": title, "source": source}
        audio_src, meta = download_audio(source, workdir)
        title = meta["title"]
    else:
        src_path = Path(source).expanduser()
        if not src_path.exists():
            raise TranscribeError(f"Local file not found: {src_path}")
        audio_src, title = src_path, src_path.stem
        meta = {"title": title, "url": None, "source_file": str(src_path.resolve())}
        stem = out_dir / sanitize(title)
        if args.skip_existing and all(p.exists() for p in output_paths(stem, formats)):
            log(f"{prefix}Skipping (already transcribed): {title!r}")
            return {"status": "skipped", "title": title, "source": source}

    t0 = time.time()
    wav = to_wav(audio_src, workdir)
    audio_seconds = _wav_duration(wav)
    result = transcribe(wav, repo, args)

    # Augment metadata with details only known after transcription.
    meta = dict(meta)
    meta["model"] = repo
    meta["language"] = result.get("language")
    meta["transcribed_at"] = datetime.now().isoformat(timespec="seconds")
    if not meta.get("duration_seconds"):
        meta["duration_seconds"] = round(audio_seconds) or None

    stem = out_dir / sanitize(title)
    written = write_outputs(result, stem, formats, meta,
                            include_meta=not args.no_metadata)
    if args.save_audio:
        kept = stem.with_suffix(audio_src.suffix)
        shutil.copy2(audio_src, kept)
        written.append(kept)

    elapsed = time.time() - t0
    rtf = (audio_seconds / elapsed) if elapsed else 0
    log(f"Done in {fmt_duration(elapsed)} "
        f"({rtf:.1f}x realtime for {fmt_duration(audio_seconds)} of audio)")
    if result.get("language"):
        log(f"Language: {result['language']}")
    log("Wrote:")
    for p in written:
        print(f"      {p}")
    return {
        "status": "ok",
        "title": title,
        "source": source,
        "audio_seconds": audio_seconds,
        "elapsed": elapsed,
    }


# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe YouTube URLs (or local files) with local MLX Whisper.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "sources", nargs="*",
        help="One or more YouTube URLs, local audio/video files, or a .txt list "
             "of URLs (one per line).",
    )
    parser.add_argument(
        "-b", "--batch", action="append", metavar="FILE",
        help="File with one URL per line (# comments + blanks ignored). "
             "Repeatable. Combine with positional sources too.",
    )
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
        "-f", "--formats", default="txt",
        help="Comma-separated output formats: txt, srt, vtt, json (default: txt). "
             "srt/vtt/json carry the same words plus per-segment timestamps.",
    )
    parser.add_argument(
        "--no-metadata", action="store_true",
        help="Don't prepend the source metadata block (URL, title, description...).",
    )
    parser.add_argument(
        "--skip-existing", action="store_true",
        help="Skip items whose output files already exist (resume a batch).",
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
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Stream the transcript text live as it's decoded (instead of a bar).",
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="No transcription progress bar/text (keeps the step logging).",
    )
    args = parser.parse_args()

    require_binary("ffmpeg", "Install with: brew install ffmpeg")

    targets = collect_targets(args)
    if not targets:
        die("No inputs. Pass a URL, a local file, or --batch <file-of-urls>.")

    repo = MODELS.get(args.model, args.model)  # allow raw HF repo ids too
    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    if not formats:
        die("No output formats selected (see --formats).")
    out_dir = Path(args.output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    workdir = out_dir / ".work"

    total = len(targets)
    is_batch = total > 1
    log(f"{total} item(s) to transcribe -> {out_dir}")
    log(f"Model: {repo}")
    log("(first run downloads the model to ~/.cache/huggingface, then it's cached)")

    results = []
    batch_t0 = time.time()
    try:
        for i, source in enumerate(targets, 1):
            prefix = f"[{i}/{total}] " if is_batch else ""
            print()
            log(f"{prefix}{source}")
            try:
                results.append(process_one(source, args, repo, formats, out_dir,
                                            workdir, prefix))
            except TranscribeError as e:
                log(f"{prefix}FAILED: {e}")
                results.append({"status": "failed", "source": source, "error": str(e)})
            except Exception as e:  # noqa: BLE001 - keep the batch alive
                log(f"{prefix}FAILED (unexpected {type(e).__name__}): {e}")
                results.append({"status": "failed", "source": source, "error": str(e)})
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    _print_summary(results, time.time() - batch_t0, is_batch)

    if any(r["status"] == "failed" for r in results):
        sys.exit(1)


def _print_summary(results: list[dict], elapsed: float, is_batch: bool) -> None:
    ok = [r for r in results if r["status"] == "ok"]
    skipped = [r for r in results if r["status"] == "skipped"]
    failed = [r for r in results if r["status"] == "failed"]
    if not is_batch:
        return  # single-item runs already printed their own "Done" line

    audio_total = sum(r.get("audio_seconds", 0) for r in ok)
    print("\n" + "-" * 60)
    log(f"Batch complete in {fmt_duration(elapsed)}  |  "
        f"{len(ok)} done, {len(skipped)} skipped, {len(failed)} failed")
    if audio_total:
        log(f"Transcribed {fmt_duration(audio_total)} of audio total")
    if failed:
        log("Failures:")
        for r in failed:
            print(f"      - {r['source']}\n          {r['error']}")


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
