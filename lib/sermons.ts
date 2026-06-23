// Sermon library data + lookup helpers.
// Data lives in the git-backed content store (data/content.json); this module
// hydrates it into the synchronous, label-based shape the site has always used.

import contentData from '@/data/content.json';
import type { ContentFile } from '@/lib/admin/types';

export type ThemeKey =
  | 'mission'
  | 'discipleship'
  | 'future'
  | 'salvation'
  | 'repentance';

export interface Theme {
  key: ThemeKey;
  /** URL slug for /themes/[theme]. */
  slug: string;
  name: string;
  blurb: string;
}

export interface Sermon {
  id: string;
  /** URL slug for /sermons/[slug] (derived from the title, SEO-friendly). */
  slug: string;
  videoId: string;
  title: string;
  /** Scripture reference, e.g. "Ephesians 3". */
  ref: string;
  /** Retained from migration; not entered or displayed (D3). */
  preacher?: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  category: ThemeKey;
  featured?: boolean;
  /** Hydrated to tag *labels* for the UI/search (stored as ids — see lib/admin). */
  tags: string[];
  short: string;
  long: string[];
  /** Optional; omitted/empty ⇒ no transcript section and absent from JSON-LD. */
  transcript?: string;
  /** ISO timestamp set on every admin write; feeds sitemap freshness. */
  updatedAt?: string;
}

// Five streams every message flows through. Order is intentional.
export const THEMES: Theme[] = [
  {
    key: 'mission',
    slug: 'mission',
    name: 'Mission',
    blurb: "God's heart for the nations and our part in His unfolding plan.",
  },
  {
    key: 'discipleship',
    slug: 'discipleship',
    name: 'Discipleship',
    blurb: 'Growing as a follower of Jesus — day by day, to the very end.',
  },
  {
    key: 'future',
    slug: 'future',
    name: 'Future Hope',
    blurb: 'The promises that anchor us — Christ’s return and the life to come.',
  },
  {
    key: 'salvation',
    slug: 'salvation',
    name: 'Salvation',
    blurb: 'How God rescues the lost and makes all things new.',
  },
  {
    key: 'repentance',
    slug: 'repentance',
    name: 'Repentance',
    blurb: 'Turning back to God with a whole and tender heart.',
  },
];

// ---------------------------------------------------------------------------
// Data source: the git-backed content store (data/content.json).
// A sermon stores tag *ids*; we hydrate them into the `tags: string[]` of labels
// the UI/search expect. Editing this data happens through the admin panel, which
// commits content.json and triggers a rebuild — see lib/admin + the admin spec.
// ---------------------------------------------------------------------------
const content = contentData as unknown as ContentFile;

const tagLabelById = new Map(content.tags.map((t) => [t.id, t.label] as const));

export const SERMONS: Sermon[] = content.sermons.map((s) => ({
  ...s,
  category: s.category as ThemeKey,
  tags: s.tags
    .map((id) => tagLabelById.get(id))
    .filter((label): label is string => Boolean(label)),
}));

/** Full controlled tag vocabulary (admin pick-list + Manage-tags screen). */
export const TAGS = content.tags;

// Home "Looking for a word on…" chips ARE the tag vocabulary: render only
// non-retired tags attached to ≥1 sermon (no dead chips), most-used first.
const tagUsage = new Map<string, number>();
for (const s of content.sermons) {
  for (const id of s.tags) tagUsage.set(id, (tagUsage.get(id) ?? 0) + 1);
}
export const HOME_TAGS: string[] = content.tags
  .filter((t) => !t.retired && (tagUsage.get(t.id) ?? 0) > 0)
  .sort(
    (a, b) =>
      (tagUsage.get(b.id) ?? 0) - (tagUsage.get(a.id) ?? 0) ||
      a.label.localeCompare(b.label),
  )
  .map((t) => t.label);


// ---------------------------------------------------------------------------
// Lookups & helpers
// ---------------------------------------------------------------------------

const themeByKey = new Map(THEMES.map((t) => [t.key, t]));
const sermonBySlug = new Map(SERMONS.map((s) => [s.slug, s]));

export function getTheme(key: string): Theme | undefined {
  return themeByKey.get(key as ThemeKey);
}

export function themeName(key: ThemeKey): string {
  return themeByKey.get(key)?.name ?? 'Message';
}

export function getSermon(slug: string): Sermon | undefined {
  return sermonBySlug.get(slug);
}

export function thumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function thumbUrlHd(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function watchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

/** Most recent first. */
export function sermonsByDate(list: Sermon[] = SERMONS): Sermon[] {
  return [...list].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function featuredSermon(): Sermon {
  return SERMONS.find((s) => s.featured) ?? SERMONS[0];
}

export function latestSermons(excludeId?: string): Sermon[] {
  return sermonsByDate(SERMONS.filter((s) => s.id !== excludeId));
}

export function sermonsInTheme(key: ThemeKey): Sermon[] {
  return sermonsByDate(SERMONS.filter((s) => s.category === key));
}

export function themeCount(key: ThemeKey): number {
  return SERMONS.filter((s) => s.category === key).length;
}

export function themeCountLabel(key: ThemeKey): string {
  const n = themeCount(key);
  return n === 0 ? 'Coming soon' : n === 1 ? '1 message' : `${n} messages`;
}

export function relatedSermons(sermon: Sermon): Sermon[] {
  return sermonsByDate(
    SERMONS.filter((s) => s.category === sermon.category && s.id !== sermon.id),
  );
}

/**
 * Sermons carrying an exact tag (the home chips are now real vocabulary tags,
 * so we match by exact tag membership rather than a loose substring scan).
 */
export function sermonsForTag(tag: string): Sermon[] {
  const t = tag.trim().toLowerCase();
  return sermonsByDate(
    SERMONS.filter((s) => s.tags.some((label) => label.toLowerCase() === t)),
  );
}

/** Free-text search across title, summary, body, tags, theme, and reference. */
export function searchSermons(query: string): Sermon[] {
  const q = query.toLowerCase();
  return sermonsByDate(
    SERMONS.filter((s) =>
      `${s.title} ${s.short} ${s.long.join(' ')} ${s.tags.join(' ')} ${themeName(
        s.category,
      )} ${s.ref}`
        .toLowerCase()
        .includes(q),
    ),
  );
}
