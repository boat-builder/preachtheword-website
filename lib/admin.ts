// Admin-panel client helpers (presentation only).
//
// The admin UI is wired to the real backend: data is loaded server-side via
// lib/admin/read.ts and mutated through the server actions in lib/admin/actions.ts.
// This module only holds small client-side display helpers used by the admin UI.

import { THEMES, type Sermon, type ThemeKey } from '@/lib/sermons';

export { THEMES };
export type { Sermon, ThemeKey };

/**
 * URL-safe slug from a title, for the live title→slug *preview* in the form.
 * The server (lib/admin/slugify) owns the authoritative slug (it also
 * transliterates accents); this is only a client convenience.
 */
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/** Short date for the library rows, e.g. "Jun 15, 2026". */
export function formatAdminDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Today as YYYY-MM-DD, for new-sermon defaults. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
