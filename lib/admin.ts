// Admin-panel data + helpers.
//
// The admin UI is currently a self-contained, in-memory prototype — there is no
// backend yet. It seeds itself from the public sermon library (lib/sermons.ts)
// and mutates a local copy in React state. When the API lands, the seed and the
// handlers in components/admin/AdminApp.tsx are the two places to wire it up.

import { SERMONS, THEMES, type Sermon, type ThemeKey } from '@/lib/sermons';

export { THEMES };
export type { Sermon, ThemeKey };

/** The maintained list of topic tags operators choose from when tagging. */
export const ADMIN_SEED_TAGS: string[] = [
  'Brokenness',
  'Discipleship',
  'Doubt',
  'Endurance',
  'Faithfulness',
  'Finishing strong',
  'God’s purpose',
  'Hardness of heart',
  'Mission',
  'Mystery of grace',
  'New birth',
  'Pentecost',
  'Perseverance',
  'Power to witness',
  'Repentance',
  'Salvation',
  'Seeking God',
  'Self-examination',
  'The church',
  'The cross',
  'The heart',
  'The Holy Spirit',
  'Warning',
];

/** A fresh, mutable copy of the seed sermons for the admin session. */
export function seedSermons(): Sermon[] {
  return SERMONS.map((s) => ({
    ...s,
    tags: [...s.tags],
    long: [...s.long],
  }));
}

/** A few known video IDs the "Fetch details" demo can recognise. */
const KNOWN_VIDEOS: Record<string, string> = {
  'XhiPW7-m7vs': "God's Open Secret",
  CyYCgPndIcc: 'Finishing Well',
  'ZtjLm6M-5Xg': 'The Significance of the Holy Spirit',
};

export function knownVideoTitle(videoId: string): string | undefined {
  return KNOWN_VIDEOS[videoId];
}

/** URL-safe slug from a title (matches the public lib's slug shape). */
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

/** Pull an 11-char YouTube ID out of a link (or a bare ID). */
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  if (m) return m[1];
  const bare = url.trim().match(/^([\w-]{11})$/);
  return bare ? bare[1] : null;
}
