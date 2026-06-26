// Pure transformations over the content store. Each function takes the current
// ContentFile and returns a NEW one (never mutates the input), throwing a
// ContentError — carrying per-field messages where useful — on a business-rule
// violation. Keeping these pure makes them unit-testable and lets the commit
// layer safely re-apply them on a 409 conflict retry (see github.ts).

import type { ContentFile, SermonRecord, TagRecord } from './types';
import { slugify, uniqueSlug } from './slugify';
import type { SermonInputParsed } from './validation';

export class ContentError extends Error {
  fieldErrors?: Record<string, string[]>;
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ContentError';
    this.fieldErrors = fieldErrors;
  }
}

const sermonPath = (slug: string) => `/sermons/${slug}`;
const clone = (c: ContentFile): ContentFile => structuredClone(c);
const dedupe = (xs: string[]) => [...new Set(xs)];

function genSermonId(taken: Set<string>): string {
  let id = `s-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id)) id = `s-${crypto.randomUUID().slice(0, 8)}`;
  return id;
}

/**
 * Validate a set of tag-id references against the vocabulary.
 * `previous` = tag ids already on the sermon (retired tags are allowed to stay,
 * but a retired tag may not be a *new* assignment — spec §5A).
 */
function validateTagRefs(
  content: ContentFile,
  tagIds: string[],
  previous: string[] = [],
): string[] {
  const byId = new Map(content.tags.map((t) => [t.id, t]));
  const prev = new Set(previous);
  const errors: string[] = [];
  for (const id of tagIds) {
    const tag = byId.get(id);
    if (!tag) {
      errors.push(`Unknown tag: ${id}`);
    } else if (tag.retired && !prev.has(id)) {
      errors.push(`Tag is retired and cannot be added: ${tag.label}`);
    }
  }
  return errors;
}

function clearFeatured(content: ContentFile, exceptId: string | null, now: string) {
  for (const s of content.sermons) {
    if (s.id !== exceptId && s.featured) {
      s.featured = false;
      s.updatedAt = now;
    }
  }
}

/** Re-point/clean the redirect list when a slug changes old → new. */
function recordSlugRedirect(content: ContentFile, oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  const from = sermonPath(oldSlug);
  const to = sermonPath(newSlug);
  // Drop a redirect that would steer the now-live new slug elsewhere (loop guard).
  content.redirects = content.redirects.filter((r) => r.from !== to);
  // Collapse chains: anything that pointed at the old slug now points at the new.
  for (const r of content.redirects) if (r.to === from) r.to = to;
  // Replace any existing redirect from the old slug, then add the fresh one.
  content.redirects = content.redirects.filter((r) => r.from !== from);
  content.redirects.push({ from, to });
}

function buildSermonFields(
  parsed: SermonInputParsed,
): Omit<SermonRecord, 'id' | 'slug' | 'featured' | 'updatedAt' | 'preacher'> {
  const fields: ReturnType<typeof buildSermonFields> = {
    videoId: parsed.videoId,
    title: parsed.title,
    ref: parsed.ref,
    date: parsed.date,
    category: parsed.category,
    tags: dedupe(parsed.tags),
    short: parsed.short,
    long: parsed.long,
  };
  // Only persist a duration when provided (omitted ⇒ no duration shown).
  if (parsed.durationSeconds) {
    fields.durationSeconds = parsed.durationSeconds;
  }
  // Only persist a transcript when non-empty (spec: empty ⇒ omit it entirely).
  if (parsed.transcript && parsed.transcript.trim()) {
    fields.transcript = parsed.transcript;
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Sermons
// ---------------------------------------------------------------------------

export function createSermon(
  content: ContentFile,
  parsed: SermonInputParsed,
  now: string,
): { content: ContentFile; sermon: SermonRecord } {
  const next = clone(content);
  const tagIds = dedupe(parsed.tags);

  const tagErrors = validateTagRefs(next, tagIds);
  if (tagErrors.length) throw new ContentError('Invalid tags', { tags: tagErrors });

  const existingSlugs = new Set(next.sermons.map((s) => s.slug));
  let slug: string;
  if (parsed.slug) {
    if (existingSlugs.has(parsed.slug)) {
      throw new ContentError('Slug already in use', {
        slug: ['That slug is already in use by another sermon'],
      });
    }
    slug = parsed.slug;
  } else {
    slug = uniqueSlug(parsed.title, existingSlugs);
  }

  const id = genSermonId(new Set(next.sermons.map((s) => s.id)));

  const sermon: SermonRecord = {
    id,
    slug,
    ...buildSermonFields(parsed),
    tags: tagIds,
    updatedAt: now,
  };

  if (parsed.featured === true) {
    clearFeatured(next, null, now);
    sermon.featured = true;
  }

  next.sermons.push(sermon);
  return { content: next, sermon };
}

export function updateSermon(
  content: ContentFile,
  id: string,
  parsed: SermonInputParsed,
  now: string,
): { content: ContentFile; sermon: SermonRecord; slugChanged: boolean } {
  const next = clone(content);
  const sermon = next.sermons.find((s) => s.id === id);
  if (!sermon) throw new ContentError('Sermon not found');

  const tagIds = dedupe(parsed.tags);
  const tagErrors = validateTagRefs(next, tagIds, sermon.tags);
  if (tagErrors.length) throw new ContentError('Invalid tags', { tags: tagErrors });

  // Slug only changes on an explicit, different override (editing the title
  // never moves the slug — spec §2.3).
  let slugChanged = false;
  if (parsed.slug && parsed.slug !== sermon.slug) {
    const takenByOthers = new Set(
      next.sermons.filter((s) => s.id !== id).map((s) => s.slug),
    );
    if (takenByOthers.has(parsed.slug)) {
      throw new ContentError('Slug already in use', {
        slug: ['That slug is already in use by another sermon'],
      });
    }
    recordSlugRedirect(next, sermon.slug, parsed.slug);
    sermon.slug = parsed.slug;
    slugChanged = true;
  }

  Object.assign(sermon, buildSermonFields(parsed), { tags: tagIds });
  // buildSermonFields omits these when empty; clear values that were just removed.
  if (!parsed.durationSeconds) delete sermon.durationSeconds;
  if (!(parsed.transcript && parsed.transcript.trim())) delete sermon.transcript;

  // Tri-state featured: only change it on an explicit intent. Omitted (undefined)
  // ⇒ preserve the CURRENT stored flag, so a form edit can't un-feature the hero
  // (and can't clobber a concurrent feature change made by another operator).
  if (parsed.featured === true) {
    clearFeatured(next, id, now);
    sermon.featured = true;
  } else if (parsed.featured === false) {
    sermon.featured = false;
  }

  sermon.updatedAt = now;
  return { content: next, sermon, slugChanged };
}

export function deleteSermon(
  content: ContentFile,
  id: string,
  now: string,
  replacementFeaturedId?: string,
): { content: ContentFile } {
  const next = clone(content);
  const sermon = next.sermons.find((s) => s.id === id);
  if (!sermon) throw new ContentError('Sermon not found');

  // The public site needs at least one sermon (the home hero falls back to the
  // first sermon). Refuse to delete down to an empty library.
  if (next.sermons.length <= 1) {
    throw new ContentError(
      'You can’t remove the last sermon — the site needs at least one message.',
    );
  }

  if (sermon.featured) {
    // Don't leave the home page heroless (spec §9).
    if (!replacementFeaturedId || replacementFeaturedId === id) {
      throw new ContentError('Choose a replacement featured sermon', {
        replacementFeaturedId: ['Pick another sermon to feature before deleting this one'],
      });
    }
    const replacement = next.sermons.find((s) => s.id === replacementFeaturedId);
    if (!replacement) {
      throw new ContentError('Replacement sermon not found', {
        replacementFeaturedId: ['That sermon no longer exists'],
      });
    }
    clearFeatured(next, replacementFeaturedId, now);
    replacement.featured = true;
    replacement.updatedAt = now;
  }

  next.sermons = next.sermons.filter((s) => s.id !== id);

  // Drop dangling redirects pointing to/from the removed slug (it now 404s and
  // leaves the sitemap automatically).
  const path = sermonPath(sermon.slug);
  next.redirects = next.redirects.filter((r) => r.from !== path && r.to !== path);

  return { content: next };
}

export function setFeatured(
  content: ContentFile,
  id: string,
  now: string,
): { content: ContentFile; sermon: SermonRecord } {
  const next = clone(content);
  const sermon = next.sermons.find((s) => s.id === id);
  if (!sermon) throw new ContentError('Sermon not found');

  clearFeatured(next, id, now);
  if (!sermon.featured) {
    sermon.featured = true;
    sermon.updatedAt = now;
  }
  return { content: next, sermon };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, ' ');

function findDuplicateLabel(
  content: ContentFile,
  label: string,
  exceptId?: string,
): boolean {
  const lc = label.toLowerCase();
  return content.tags.some((t) => t.id !== exceptId && t.label.toLowerCase() === lc);
}

export function createTag(
  content: ContentFile,
  rawLabel: string,
): { content: ContentFile; tag: TagRecord } {
  const next = clone(content);
  const label = normalizeLabel(rawLabel);
  if (!label) throw new ContentError('Tag name is required', { label: ['Tag name is required'] });
  if (findDuplicateLabel(next, label)) {
    throw new ContentError('Duplicate tag', { label: ['A tag with this name already exists'] });
  }
  const id = uniqueSlug(label, next.tags.map((t) => t.id), 'tag');
  const tag: TagRecord = { id, label };
  next.tags.push(tag);
  return { content: next, tag };
}

export function renameTag(
  content: ContentFile,
  id: string,
  rawLabel: string,
): { content: ContentFile; tag: TagRecord } {
  const next = clone(content);
  const tag = next.tags.find((t) => t.id === id);
  if (!tag) throw new ContentError('Tag not found');
  const label = normalizeLabel(rawLabel);
  if (!label) throw new ContentError('Tag name is required', { label: ['Tag name is required'] });
  if (findDuplicateLabel(next, label, id)) {
    throw new ContentError('Duplicate tag', { label: ['A tag with this name already exists'] });
  }
  tag.label = label; // id unchanged ⇒ propagates to every sermon automatically
  return { content: next, tag };
}

export function setTagRetired(
  content: ContentFile,
  id: string,
  retired: boolean,
): { content: ContentFile; tag: TagRecord } {
  const next = clone(content);
  const tag = next.tags.find((t) => t.id === id);
  if (!tag) throw new ContentError('Tag not found');
  if (retired) tag.retired = true;
  else delete tag.retired;
  return { content: next, tag };
}

export function deleteTag(content: ContentFile, id: string): { content: ContentFile } {
  const next = clone(content);
  const tag = next.tags.find((t) => t.id === id);
  if (!tag) throw new ContentError('Tag not found');
  const inUse = next.sermons.some((s) => s.tags.includes(id));
  if (inUse) {
    throw new ContentError('Tag is in use', {
      id: ['This tag is used by one or more sermons. Retire it, or remove it from those sermons first.'],
    });
  }
  next.tags = next.tags.filter((t) => t.id !== id);
  return { content: next };
}
