// Canonical shape of the git-backed content store (data/content.json).
//
// IMPORTANT: this is the *storage* shape — a sermon's `tags` are TagRecord.id
// references, NOT labels. The public read layer (lib/sermons.ts) hydrates those
// ids back into the `tags: string[]` of labels that the UI/search expect.
// See admin spec Appendix A.

import type { ThemeKey } from '@/lib/sermons';

export type { ThemeKey };

export interface SermonRecord {
  /** Stable, system-generated; NEVER changes (React key / exclude key). */
  id: string;
  /** Unique kebab-case slug; the public URL segment (/sermons/<slug>). */
  slug: string;
  /** 11-char YouTube id (NOT the full URL). */
  videoId: string;
  title: string;
  /** Scripture reference, e.g. "Ephesians 3". */
  ref: string;
  /** ISO calendar date "YYYY-MM-DD". */
  date: string;
  /** Exactly one of the 5 fixed themes. */
  category: ThemeKey;
  /** Array of TagRecord.id references (NOT labels). */
  tags: string[];
  /** Summary; also the meta/social description (≤ ~160 chars). */
  short: string;
  /** Body as an array of paragraphs (≥ 1). */
  long: string[];
  /** Optional; preserves "\n". Empty/omitted ⇒ omit from page + JSON-LD. */
  transcript?: string;
  /** At most ONE record may be true. */
  featured?: boolean;
  /** Retained from migration, not edited via admin, not displayed (D3). */
  preacher?: string;
  /** ISO timestamp, set on every write; feeds sitemap freshness. */
  updatedAt?: string;
}

export interface TagRecord {
  /** Stable; does NOT change when the label is renamed. */
  id: string;
  /** Display text; reader-facing (also the home "need" chips). */
  label: string;
  /** true ⇒ hidden from the sermon pick-list, kept on sermons already using it. */
  retired?: boolean;
}

export interface Redirect {
  /** Old path, e.g. "/sermons/old-slug". */
  from: string;
  /** New path, e.g. "/sermons/new-slug". */
  to: string;
}

export interface ContentFile {
  sermons: SermonRecord[];
  tags: TagRecord[];
  redirects: Redirect[];
}

/** Result envelope returned by every admin server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
