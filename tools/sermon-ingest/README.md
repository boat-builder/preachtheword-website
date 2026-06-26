# sermon-ingest (Claude plugin)

A Claude **Cowork** plugin that turns a raw, machine-generated sermon transcript
into a publish-ready record in this project's content store (`data/content.json`).

It ships one skill, **`transcript-to-sermon`**, which:

1. Picks one `.txt` from `tools/transcribe/transcripts/`.
2. Pulls metadata (videoId, title, ref, date, preacher, duration, summary) from
   the file header.
3. Rewrites the spoken transcript into clean, bookish written prose — fixing
   mis-transcribed Bible names/references and stripping song lyrics and looped
   ASR noise, **without losing any real story, quote, or illustration**.
4. Writes a single staged JSON file (never edits `content.json` by hand).
5. Spawns a **verification sub-agent** to check the result against the original.
6. Runs `scripts/merge_sermon.py` to validate and merge the record safely
   (allocates id + unique slug, registers new tags, atomic write).
7. Deletes the source transcript on success so the next run picks a fresh one.

## Why a script does the merge

`data/content.json` powers many public pages; a single bad edit breaks them. The
AI only ever produces a small, isolated staged file — the Python script is the
only thing that touches `content.json`, and it validates everything first and
writes atomically, so the AI can't corrupt the store.

## Install in Cowork

From this repo, add the plugin by local path (it lives at
`tools/sermon-ingest`), then invoke the skill by asking, e.g.:

> "Process the next sermon transcript."

The skill triggers on requests to ingest / convert / publish a transcript from
`tools/transcribe/transcripts/`.

It assumes Cowork runs with this repository as the working directory (so
`tools/transcribe/transcripts/` and `data/content.json` resolve).

## The merge script (standalone)

You can also run the merge step by hand:

```bash
# preview only — writes nothing
python3 tools/sermon-ingest/skills/transcript-to-sermon/scripts/merge_sermon.py \
  tools/transcribe/transcripts/.work/<slug>.json --dry-run

# merge + delete the source transcript
python3 tools/sermon-ingest/skills/transcript-to-sermon/scripts/merge_sermon.py \
  tools/transcribe/transcripts/.work/<slug>.json \
  --source "tools/transcribe/transcripts/<source>.txt"
```

Pure standard-library Python 3 — no dependencies. It refuses to add a sermon
whose `videoId` already exists (duplicate guard).

## Layout

```
tools/sermon-ingest/
├── .claude-plugin/plugin.json
├── README.md
└── skills/transcript-to-sermon/
    ├── SKILL.md
    └── scripts/merge_sermon.py
```
