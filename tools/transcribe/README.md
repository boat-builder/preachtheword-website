# YouTube → Transcript (local, Apple Silicon)

Download YouTube videos' audio and transcribe them **fully locally** using
[MLX Whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper),
which runs `whisper-large-v3` on the Mac GPU (Metal). Built for long-form audio
(1–2 hour sermons / talks) where **accuracy is the priority**. Does one video or
a whole batch in a single run.

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

# Also emit timestamped subtitles / structured JSON (not just plain text)
uv run transcribe.py "<url>" --formats txt,srt,vtt,json
```

By default you get a single `./transcripts/<video title>.txt`. The optional
`srt` / `vtt` / `json` formats hold the **same words** — they just add
per-segment timestamps (and `json` is the structured form). Request them with
`--formats` only if you need captions or timing.

## Metadata header

Each transcript is self-describing — whatever YouTube exposes (title, URL,
channel, upload date, duration, video ID, views, categories, tags, description)
is captured and written alongside the transcript:

- **`.txt`** — a `===`-delimited block at the very top, then the transcript:

  ```text
  ========================================================================
  Title:        Habakkuk 1 — Why, God?
  URL:          https://www.youtube.com/watch?v=XXXXXXXXXXX
  Channel:      Grace Church  (https://www.youtube.com/@...)
  Uploaded:     2024-03-10
  Duration:     1:04:22
  Video ID:     XXXXXXXXXXX
  Views:        12,345
  Categories:   People & Blogs
  Tags:         sermon, habakkuk, faith
  Model:        mlx-community/whisper-large-v3-mlx
  Language:     en
  Transcribed:  2026-06-26T10:29:21

  Description:
    <the video's full description, indented>
  ========================================================================

  <transcript text...>
  ```

- **`.json`** — a `metadata` object next to `text` / `segments` / `language`.
- **`.vtt`** — the same fields as a spec-valid `NOTE` block (players ignore it).
- **`.srt`** — kept clean (no header), since arbitrary text breaks SRT parsers.

Pass `--no-metadata` to omit the block. Local files get what's available
(filename, source path, duration).

## Batch processing

Transcribe many videos in one run. The model loads **once** and is reused across
every item, so there's no per-video startup cost.

Make a list file — one URL per line; blank lines and `#` comments are ignored
(see [`links.example.txt`](links.example.txt)):

```text
https://www.youtube.com/watch?v=AAAAAAAAAAA
https://www.youtube.com/watch?v=BBBBBBBBBBB
# this one is skipped
# https://www.youtube.com/watch?v=CCCCCCCCCCC
```

Then run any of:

```bash
# Explicit batch flag (repeatable; combine with --skip-existing to resume)
uv run transcribe.py --batch links.txt --skip-existing

# A .txt / .list file as a positional arg is auto-detected as a URL list
uv run transcribe.py links.txt

# Or just list URLs directly on the command line
uv run transcribe.py "<url1>" "<url2>" "<url3>"
```

Each video is processed independently: if one fails (private, removed, network
error) it's logged and the batch continues. At the end you get a summary —
`N done, M skipped, K failed` — with the reason for each failure, and the script
exits non-zero if anything failed (handy for scripting). `--skip-existing` skips
any video whose transcript files are already present, so you can safely re-run an
interrupted batch.

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `-b, --batch` | – | File with one URL per line (`#` comments + blanks ignored). Repeatable; combinable with positional sources. |
| `--skip-existing` | off | Skip items whose transcript files already exist (resume a batch). |
| `-m, --model` | `large-v3` | `large-v3`, `large-v3-turbo`, `large-v3-q4`, `turbo-q4`, `medium`, `small`, `tiny`, or any HF repo id. |
| `-o, --output-dir` | `./transcripts` | Output directory. |
| `-l, --language` | auto | Force a language code, e.g. `en`. Skips detection. |
| `-p, --prompt` | – | Initial prompt to bias spelling/punctuation. |
| `-f, --formats` | `txt` | Comma-separated subset of `txt,srt,vtt,json`. The others add per-segment timestamps. |
| `--no-metadata` | off | Omit the source metadata block from outputs. |
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
