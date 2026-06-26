#!/usr/bin/env python3
"""Merge a single staged sermon JSON into data/content.json — safely.

The AI agent is NOT allowed to hand-edit data/content.json (one bad keystroke
breaks many public pages). Instead it writes ONE sermon to a small staging file
and runs this script, which validates the record, allocates the id/slug, folds
new tags into the shared vocabulary, and rewrites content.json atomically with
the exact formatting the file already uses (2-space indent, trailing newline,
unicode preserved).

Usage:
    python merge_sermon.py <staged-sermon.json> [--content data/content.json] \
        [--source <transcript.txt>] [--dry-run]

Staged sermon JSON shape (what the agent produces):
    {
      "videoId":   "CyYCgPndIcc",          # full URL also accepted
      "title":     "Finishing Well",         # clean sermon title (no "| ref | preacher")
      "ref":       "2 Timothy 2:8",          # scripture reference
      "date":      "2022-08-09",             # YYYY-MM-DD (from Uploaded)
      "category":  "discipleship",           # one of the 5 theme keys
      "tags":      ["Finishing strong", ...],# LABELS (human text), not ids
      "short":     "One-to-two sentence summary (<= ~160 chars).",
      "long":      ["paragraph 1", "paragraph 2", ...],  # the written sermon
      "preacher":  "Rev. Joe Thomas",       # optional
      "durationSeconds": 2754,               # optional
      "featured":  false                      # optional; omit unless explicitly featuring
    }

On success the new record is appended, any new tags are added to the top-level
`tags` array, and (if --source is given) the source transcript .txt is deleted
so the next run won't pick it up again. --source is only honored AFTER the write
succeeds, so a failed merge never deletes the transcript.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

# The 5 fixed themes — must stay in sync with THEME_KEYS in lib/admin/validation.ts.
THEME_KEYS = {"mission", "discipleship", "future", "salvation", "repentance"}

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def fail(msg: str) -> "None":
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# slugify — must match lib/admin/slugify.ts exactly (slugs are URLs / ids).
# ---------------------------------------------------------------------------
def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text)
    s = re.sub(r"[̀-ͯ]", "", s)          # strip combining diacritics
    s = re.sub(r"['’‘`´ʼ]", "", s)  # drop apostrophes
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)              # non-alphanumeric runs -> hyphen
    s = re.sub(r"-{2,}", "-", s)                    # collapse repeats
    s = s.strip("-")                                # trim leading/trailing hyphens
    return s


def unique_slug(desired: str, taken: set[str], fallback: str = "sermon") -> str:
    base = slugify(desired) or slugify(fallback) or "sermon"
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def extract_video_id(value: str) -> str | None:
    """Accept a bare 11-char id or a YouTube URL; return the id or None."""
    raw = value.strip()
    if VIDEO_ID_RE.match(raw):
        return raw
    m = re.search(r"(?:v=|/embed/|/shorts/|/live/|/v/|youtu\.be/)([A-Za-z0-9_-]{11})", raw)
    return m.group(1) if m else None


def is_valid_calendar_date(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def find_content_path(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit).resolve()
        if not p.is_file():
            fail(f"content file not found: {p}")
        return p
    # Walk up from cwd looking for data/content.json.
    for base in [Path.cwd(), *Path.cwd().parents]:
        candidate = base / "data" / "content.json"
        if candidate.is_file():
            return candidate.resolve()
    fail("could not locate data/content.json (pass --content explicitly)")


def next_sermon_id(sermons: list[dict]) -> str:
    max_n = 0
    for s in sermons:
        m = re.match(r"^s(\d+)$", str(s.get("id", "")))
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"s{max_n + 1}"


def resolve_tags(labels: list[str], tag_records: list[dict]) -> list[str]:
    """Map human tag labels to TagRecord ids, creating new records as needed.

    Matches existing tags by slugified id so casing/punctuation variants reuse
    the same tag instead of spawning duplicates. Mutates tag_records in place.
    """
    by_id = {t["id"]: t for t in tag_records}
    result_ids: list[str] = []
    for label in labels:
        label = label.strip()
        if not label:
            continue
        base = slugify(label)
        if not base:
            continue
        if base in by_id:
            tid = base
        else:
            # New tag — allocate the slugified id (de-duped against taken ids).
            tid = base
            n = 2
            while tid in by_id:
                tid = f"{base}-{n}"
                n += 1
            record = {"id": tid, "label": label}
            tag_records.append(record)
            by_id[tid] = record
        if tid not in result_ids:
            result_ids.append(tid)
    return result_ids


def build_record(staged: dict, content: dict) -> dict:
    sermons = content["sermons"]
    tag_records = content["tags"]

    # --- required fields -----------------------------------------------------
    raw_video = staged.get("videoId")
    if not isinstance(raw_video, str) or not raw_video.strip():
        fail("videoId is required")
    video_id = extract_video_id(raw_video)
    if not video_id:
        fail(f"videoId is not a valid YouTube link or 11-char id: {raw_video!r}")

    if any(s.get("videoId") == video_id for s in sermons):
        fail(
            f"a sermon with videoId {video_id} already exists in content.json "
            "(refusing to add a duplicate)"
        )

    title = (staged.get("title") or "").strip()
    if not title:
        fail("title is required")
    if len(title) > 200:
        fail("title is too long (max 200 chars)")

    ref = (staged.get("ref") or "").strip()
    if not ref:
        fail("ref (scripture reference) is required")

    date = (staged.get("date") or "").strip()
    if not DATE_RE.match(date) or not is_valid_calendar_date(date):
        fail(f"date must be a valid YYYY-MM-DD calendar date, got {date!r}")

    category = (staged.get("category") or "").strip()
    if category not in THEME_KEYS:
        fail(f"category must be one of {sorted(THEME_KEYS)}, got {category!r}")

    short = (staged.get("short") or "").strip()
    if not short:
        fail("short (summary) is required")
    if len(short) > 300:
        fail(f"short is too long ({len(short)} chars, hard cap 300)")
    if len(short) > 200:
        print(
            f"WARNING: short is {len(short)} chars; the meta-description soft cap is ~160.",
            file=sys.stderr,
        )

    long = staged.get("long")
    if not isinstance(long, list) or not long:
        fail("long must be a non-empty array of paragraph strings")
    long = [p.strip() for p in long if isinstance(p, str) and p.strip()]
    if not long:
        fail("long has no non-empty paragraphs")

    # --- slug / id -----------------------------------------------------------
    taken_slugs = {s.get("slug") for s in sermons}
    desired_slug = staged.get("slug") or title
    slug = unique_slug(desired_slug, taken_slugs)

    record: dict = {
        "id": next_sermon_id(sermons),
        "slug": slug,
        "videoId": video_id,
        "title": title,
        "ref": ref,
        "date": date,
        "category": category,
        "tags": resolve_tags(staged.get("tags") or [], tag_records),
        "short": short,
        "long": long,
    }

    # --- optional fields -----------------------------------------------------
    dur = staged.get("durationSeconds")
    if dur not in (None, ""):
        try:
            dur = int(dur)
        except (TypeError, ValueError):
            fail(f"durationSeconds must be an integer, got {dur!r}")
        if dur <= 0 or dur > 86400:
            fail(f"durationSeconds out of range (1..86400), got {dur}")
        record["durationSeconds"] = dur

    if staged.get("featured") is True:
        # Only one record may be featured — un-feature any current one.
        for s in sermons:
            if s.get("featured"):
                s.pop("featured", None)
        record["featured"] = True

    preacher = (staged.get("preacher") or "").strip()
    if preacher:
        record["preacher"] = preacher

    record["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return record


def write_atomic(path: Path, content: dict) -> None:
    text = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge a staged sermon JSON into content.json")
    ap.add_argument("staged", help="Path to the staged single-sermon JSON file")
    ap.add_argument("--content", help="Path to content.json (default: nearest data/content.json)")
    ap.add_argument("--source", help="Path to the source transcript .txt to delete on success")
    ap.add_argument("--dry-run", action="store_true", help="Validate + print the record; do not write")
    ap.add_argument(
        "--keep-staged",
        action="store_true",
        help="Keep the staged JSON after a successful merge (default: delete it)",
    )
    args = ap.parse_args()

    staged_path = Path(args.staged)
    if not staged_path.is_file():
        fail(f"staged sermon file not found: {staged_path}")
    try:
        staged = json.loads(staged_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"staged sermon file is not valid JSON: {e}")

    content_path = find_content_path(args.content)
    try:
        content = json.loads(content_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"content.json is not valid JSON: {e}")

    for key in ("sermons", "tags", "redirects"):
        content.setdefault(key, [])

    ids_before = {t["id"] for t in content["tags"]}
    record = build_record(staged, content)
    new_tag_labels = [t["label"] for t in content["tags"] if t["id"] not in ids_before]

    def report_new_tags(would: bool) -> None:
        verb = "would be created" if would else "created"
        if new_tag_labels:
            print(
                f"\n{len(new_tag_labels)} NEW tag(s) {verb}: "
                + ", ".join(repr(t) for t in new_tag_labels)
                + "\n  ^ check these aren't variations of an existing tag; if one is,"
                " edit the staged tag label to the existing one and rerun."
            )
        else:
            print(f"\nNo new tags {verb} (all matched the existing vocabulary).")

    if args.dry_run:
        print("DRY RUN — record that WOULD be added:\n")
        print(json.dumps(record, ensure_ascii=False, indent=2))
        report_new_tags(would=True)
        return

    content["sermons"].append(record)
    write_atomic(content_path, content)

    print(
        f"OK: added sermon {record['id']} '{record['title']}' "
        f"(slug: {record['slug']}, {len(record['long'])} paragraphs, "
        f"{len(record['tags'])} tags) -> {content_path}"
    )
    report_new_tags(would=False)

    # Clean up the source transcript and the throwaway staged file — only now,
    # after the write succeeded, so a failed merge never loses anything.
    if args.source:
        src = Path(args.source)
        if src.is_file():
            src.unlink()
            print(f"OK: deleted source transcript {src}")
        else:
            print(f"WARNING: --source given but not found: {src}", file=sys.stderr)

    if not args.keep_staged:
        # Remove only the staged file we were handed — never the .work directory
        # itself, which is shared with other processes.
        staged_path.unlink(missing_ok=True)
        print(f"OK: removed staged file {staged_path}")


if __name__ == "__main__":
    main()
