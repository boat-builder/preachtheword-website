---
name: transcript-to-sermon
description: >-
  Turn a raw sermon transcript into a publish-ready sermon record for the Preach
  the Word backend (data/content.json). Use when the user wants to ingest,
  process, convert, or publish a transcript from tools/transcribe/transcripts/ —
  e.g. "process the next sermon transcript", "add the transcript to the site",
  "convert the transcript to content.json". Picks ONE transcript, rewrites the
  spoken words into a clean written sermon, verifies it with a sub-agent, merges
  it via a Python script, and deletes the source transcript.
---

# Transcript → Sermon

Convert one raw, machine-generated sermon transcript into a written sermon record
and add it to the site's content store (`data/content.json`).

The transcript is auto-generated speech-to-text. Expect: misheard words, wrong
words, and especially mangled **Bible names / terms / references** (the preacher
is a fluent but non-native English speaker). Expect **garbage**: song lyrics,
worship-music artifacts, and looped/stuttered phrases (the same line repeated
many times). Your job is to recover the *actual sermon* as clean, bookish prose —
**without losing any real content, story, illustration, or quote.**

Never hand-edit `data/content.json`. You write ONE small staged JSON file, then a
Python script merges it in safely. Process exactly **one** transcript per run.

## Procedure

### 1. Pick one transcript

List `tools/transcribe/transcripts/*.txt`. If there are none, stop and tell the
user there's nothing to process. Otherwise pick one (alphabetically first is
fine), and tell the user which file you're processing.

### 2. Read the file and split it

Each file has a metadata header between two `======` rules, then the transcript
body. Read the **whole** file.

### 3. Extract the metadata fields

From the header:

- **videoId** — from the `URL:` or `Video ID:` line (the script also accepts the full URL).
- **title** — the *clean sermon title only*. The header `Title:` is
  `SERMON NAME | Scripture | Preacher | Church`. Keep just the sermon name in
  natural title case. e.g. `FINISHING WELL | 2 Timothy 2:8 | Rev. Joe Thomas | CGLD` → `Finishing Well`.
- **ref** — the scripture reference from that title, e.g. `2 Timothy 2:8`.
- **date** — the `Uploaded:` date, as `YYYY-MM-DD`.
- **preacher** — the preacher from the title, e.g. `Rev. Joe Thomas`.
- **durationSeconds** — convert `Duration: 45:54` → `2754` (mm:ss or h:mm:ss).
- **short** — the summary. Look in the `Description:` block for a human-written
  summary paragraph (NOT the links, hashtags, playlist URLs, service times, or
  church boilerplate). Use it, trimmed to one or two sentences (~160 chars, hard
  cap 300). If the description is *only* boilerplate/links, write a concise
  1–2 sentence summary yourself from the sermon.

### 4. Write the long-form sermon (the main task)

Rewrite the transcript body into **`long`**: an array of clean, written-prose
paragraphs. This is the heart of the task.

**Do:**
- Convert conversational speech into smooth, *bookish* written English — full
  sentences, real paragraphs, natural transitions. Match the tone of the existing
  `long` entries in `data/content.json` (flowing and readable, not a word-for-word
  transcript).
- **Fix transcription errors as you go — every file has its own.** Don't rely on
  a fixed list; instead, while reading, treat anything that doesn't parse as a
  real word/name/reference as a likely mis-hear and recover what was meant:
  - **Bible names, places, and terms**: if a word sounds like a garbled proper
    noun (people, places, books), correct it to the real spelling. A good tell is
    that it isn't an actual Bible name. *(Illustrative only — yours will differ:
    one file had `Onesi for us` → Onesiphorus, `Loyalists and unisists` → Lois
    and Eunice, `Thomas C. Auden` → Thomas C. Oden.)*
  - **Scripture quotations and references**: verify every quoted verse and every
    book/chapter/verse citation against the actual biblical text and fix drift.
  - **Other proper nouns**: authors, theologians, historical figures, place
    names — sanity-check and correct.
  - If you genuinely can't tell what a garbled span was meant to be, keep the
    closest sensible reading and flag it to the user rather than guessing wildly.
- **Preserve every real detail** — keep all illustrations, stories, statistics,
  named quotes, and personal anecdotes in full (e.g. the Clinton "finishing well"
  research, the baptism story, the missionary-couple / Teddy Roosevelt story, the
  Packer / Chrysostom / Oden quotes). Do not summarize them away.
- Keep the sermon's structure (e.g. its three points) intact.

**Don't:**
- Don't add ideas, applications, or theology the preacher didn't say.
- Don't keep ASR garbage: drop song/worship lyrics and music artifacts, and
  collapse looped/stuttered repetitions (a phrase repeated 5–20× like
  "To reach God. To reach God…", "Resurrectionism! Resurrectionism!…",
  "went down to God…", or a trailing "Thank you. Thank you."). Keep the *point*
  being made, discard the noise.
- Don't invent a value for any field — if something genuinely isn't recoverable,
  flag it to the user.

### 5. Pick category and tags

- **category** — exactly ONE of these 5 theme keys (no others):
  `mission`, `discipleship`, `future`, `salvation`, `repentance`.
- **tags** — 3–5 short topical **labels** (human text, e.g. `"Perseverance"`).
  **First read the full `tags` array in `data/content.json`** and prefer an
  existing label whenever one fits — including when the natural wording is just a
  *variation* of an existing tag (singular/plural, a synonym, or a reworded form).
  e.g. if `Endurance` already exists, use it rather than coining `Endurance in
  faith` or `Perseverance`. Only introduce a genuinely new theme.

  Note what the script does and does *not* dedupe: it maps each label to an id and
  reuses the existing tag when the id matches, so casing/punctuation/whitespace
  variants (`The Heart` / `the heart`) collapse automatically — but **semantic**
  near-duplicates (synonyms, plurals) it cannot catch, so that judgement is on
  you. The dry-run in step 8 prints any NEW tags it would create; treat that list
  as a checkpoint — if a "new" tag is really a variation of an existing one, change
  the label to the existing one and rerun.

### 6. Write the staged JSON

Write a single sermon object to `tools/transcribe/transcripts/.work/<slug>.json`
(create the `.work/` dir if needed — it's git-ignored). Shape:

```json
{
  "videoId": "CyYCgPndIcc",
  "title": "Finishing Well",
  "ref": "2 Timothy 2:8",
  "date": "2022-08-09",
  "category": "discipleship",
  "tags": ["Finishing strong", "Perseverance", "Remembering Jesus"],
  "short": "Paul's last charge to Timothy: to finish the race of faith, remember Jesus Christ — raised from the dead.",
  "long": ["First written paragraph…", "Second written paragraph…"],
  "preacher": "Rev. Joe Thomas",
  "durationSeconds": 2754
}
```

Do **not** set `id`, `slug`, `updatedAt`, or `featured` — the script handles
id/slug/timestamp, and `featured` should be left off unless the user explicitly
asks to feature this sermon.

### 7. Verify with a sub-agent (required gate)

Spawn a **sub-agent** (Task/Agent tool) to independently check the staged JSON
against the original transcript. Give it both file paths and have it report
`PASS` or a specific list of problems, checking:

- No fabricated content; nothing the preacher said is added.
- No real story, illustration, statistic, or named quote was lost or shortened away.
- Bible names, terms, and references are corrected and accurate.
- Song lyrics, music artifacts, and looped repetitions were removed.
- Metadata is right: title cleaned, `ref`/`date`/`videoId` correct, `category` is
  one of the 5 keys and fits, `short` is accurate and ≤ ~160 chars, prose is bookish.

If the sub-agent finds problems, fix the staged JSON and verify again. Only move
on once it passes.

### 8. Merge into content.json

Run the bundled script (in this skill's `scripts/` directory). Preview first,
then commit:

```bash
# preview — validates and prints the record it would add, writes nothing
python3 scripts/merge_sermon.py tools/transcribe/transcripts/.work/<slug>.json --dry-run

# real run — appends the sermon, registers new tags, then deletes the source .txt
python3 scripts/merge_sermon.py tools/transcribe/transcripts/.work/<slug>.json \
  --source "tools/transcribe/transcripts/<the-source-file>.txt"
```

The script allocates the `id` and unique `slug`, validates every field, folds new
tags into the vocabulary, and writes `content.json` atomically (preserving its
exact formatting). Then — **on success only** — it cleans up: it deletes the
source transcript `.txt` (via `--source`) so the next run won't pick it up again,
and removes the staged `.work/<slug>.json` file it was given (the `.work/`
directory itself is left in place — it's shared with other processes). If it exits
non-zero, nothing was written and nothing was deleted; fix the
reported issue and rerun. (Pass `--keep-staged` if you want to keep the staged
file for debugging.)

### 9. Report

Tell the user which sermon was added (id, slug, title), how many new tags were
created, and that the source transcript was deleted.

## Notes

- The script refuses to add a sermon whose `videoId` already exists — that's a
  guard against duplicates, not an error to work around.
- Do not run the dev server or build; the user manages deployment separately.
