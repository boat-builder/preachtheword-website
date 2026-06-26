// Server-side validation for admin writes (admin spec §6). The UI may validate
// too, but this is the authoritative layer — a single bad record breaks many
// public pages, so every write is parsed here before it touches the store.
//
// Shape/format rules live here (zod). Business rules that need the current store
// — slug uniqueness, tag existence, single-featured — live in content.ts.

import { z } from 'zod';
import { extractVideoId } from './youtube';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The 5 fixed themes (code enum — not admin-editable; spec §2.2).
export const THEME_KEYS = [
  'mission',
  'discipleship',
  'future',
  'salvation',
  'repentance',
] as const;

/** Split a textarea into paragraphs on blank lines; trim and drop empties. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** True only for a real calendar date (rejects e.g. 2026-02-30). */
function isValidCalendarDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const sermonInputSchema = z.object({
  // Accept a full YouTube URL or a bare id; normalize to the 11-char id.
  videoId: z.preprocess(
    (v) => (typeof v === 'string' ? (extractVideoId(v) ?? v) : v),
    z.string().regex(VIDEO_ID_RE, 'Enter a valid YouTube link or 11-character video id'),
  ),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  short: z
    .string()
    .trim()
    .min(1, 'Summary is required')
    // Soft cap is ~160 (meta description); 300 is a hard safety limit.
    .max(300, 'Summary is too long'),
  // Accept a single textarea (split on blank lines) or a pre-split array.
  long: z.preprocess(
    (v) => (typeof v === 'string' ? splitParagraphs(v) : v),
    z
      .array(z.string().trim().min(1, 'Paragraphs cannot be empty'))
      .min(1, 'Add at least one paragraph'),
  ),
  // Whole-second video length. Empty string/null/undefined ⇒ omitted downstream.
  // Cap at 24h as a sanity bound (a sermon is never longer).
  durationSeconds: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.number().int().positive().max(86400, 'Duration looks too long').optional(),
  ),
  // Preserve newlines; do NOT trim interior content. Empty ⇒ omitted downstream.
  transcript: z.string().optional().default(''),
  // Tag *ids*; existence/retired checks happen in content.ts against the store.
  tags: z.array(z.string()).optional().default([]),
  category: z.enum(THEME_KEYS),
  // Optional override; when omitted the slug is derived from the title.
  slug: z
    .string()
    .trim()
    .regex(SLUG_RE, 'Slug must be lowercase letters, numbers, and hyphens')
    .optional(),
  date: z
    .string()
    .regex(DATE_RE, 'Date must be in YYYY-MM-DD format')
    .refine(isValidCalendarDate, 'Not a valid calendar date'),
  ref: z.string().trim().min(1, 'Scripture reference is required'),
  // Tri-state: true ⇒ feature, false ⇒ un-feature, omitted ⇒ leave as-is.
  // The sermon form has no featured control, so it omits this on edit and the
  // current featured flag is preserved server-side (no stale-snapshot un-feature).
  featured: z.boolean().optional(),
});

/** Loose shape the UI passes in (videoId may be a URL, long may be a string). */
export type SermonInput = z.input<typeof sermonInputSchema>;
/** Normalized, validated shape used internally. */
export type SermonInputParsed = z.output<typeof sermonInputSchema>;

export const tagLabelSchema = z
  .string()
  .trim()
  .min(1, 'Tag name is required')
  .max(60, 'Tag name is too long');

/** Map a ZodError into { field: [messages] } for the UI. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
