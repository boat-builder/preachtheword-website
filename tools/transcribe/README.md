# YouTube → Transcript (local, Apple Silicon)

Download a YouTube video's audio and transcribe it **fully locally** using
[MLX Whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper),
which runs `whisper-large-v3` on the Mac GPU (Metal). Built for long-form audio
(1–2 hour sermons / talks) where **accuracy is the priority**.

Nothing is uploaded anywhere — the model runs on your machine.

## Why this stack (on an M1 Max / Apple Silicon)

| Concern | Choice | Why |
| --- | --- | --- |
| Download | `yt-dlp` | Most robust YouTube downloader; grabs best audio. |
| Decode | `ffmpeg` → 16 kHz mono WAV | Canonical Whisper input; avoids format surprises. |
| STT | **MLX Whisper `large-v3`** | Highest-accuracy Whisper, GPU-accelerated on Apple Silicon. Far faster than CPU `faster-whisper` here, and more accurate than the smaller models. |

`large-v3` is the most accurate Whisper model and handles biblical proper nouns
and long monologues well. On an M1 Max a 1–2 hour talk transcribes in roughly
**10–25 min**. Need it faster? `--model large-v3-turbo` is ~2–3× quicker for a
small accuracy trade-off.

## Setup

**Option A — zero setup (recommended).** With [`uv`](https://docs.astral.sh/uv/)
installed, dependencies are declared inside the script and fetched on first run:

```bash
cd tools/transcribe
uv run transcribe.py "https://www.youtube.com/watch?v=XXXXXXXXXXX"
```

**Option B — classic venv:**

```bash
cd tools/transcribe
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python transcribe.py "https://www.youtube.com/watch?v=XXXXXXXXXXX"
```

Both require system **ffmpeg**: `brew install ffmpeg`.

> First run downloads the model (~3 GB for `large-v3`) into
> `~/.cache/huggingface`. After that it's cached and offline.

## Usage

```bash
# Most accurate (default = large-v3)
uv run transcribe.py "<url>"

# Faster, slightly less accurate
uv run transcribe.py "<url>" --model large-v3-turbo

# Force English + bias spelling of proper nouns (helps accuracy a lot)
uv run transcribe.py "<url>" --language en \
    --prompt "A Christian sermon. Names: Habakkuk, Nebuchadnezzar, Melchizedek."

# Transcribe a file you already downloaded
uv run transcribe.py ./sermon.m4a

# Keep the source audio, only emit plain text
uv run transcribe.py "<url>" --save-audio --formats txt
```

Output lands in `./transcripts/<video title>.{txt,srt,vtt,json}`.

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `-m, --model` | `large-v3` | `large-v3`, `large-v3-turbo`, `large-v3-q4`, `turbo-q4`, `medium`, `small`, `tiny`, or any HF repo id. |
| `-o, --output-dir` | `./transcripts` | Output directory. |
| `-l, --language` | auto | Force a language code, e.g. `en`. Skips detection. |
| `-p, --prompt` | – | Initial prompt to bias spelling/punctuation. |
| `-f, --formats` | `txt,srt,vtt,json` | Comma-separated subset. |
| `--word-timestamps` | off | Per-word timing (slower; tighter subtitles). |
| `--no-context` | off | Don't condition on prior text (kills rare repetition loops). |
| `--save-audio` | off | Keep the downloaded source audio. |
| `--quiet` | off | Less logging. |

## Accuracy tips for sermons

- Pass `--language en` to skip auto-detection (it only samples the first 30s).
- Use `--prompt` to seed unusual names/terms — Whisper will spell them
  consistently throughout.
- Stick with the default `large-v3`. Only drop to `turbo` if a batch is too slow.
- If you ever see a passage repeat itself, re-run that file with `--no-context`.
