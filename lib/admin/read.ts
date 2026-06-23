// Server-only read helpers for the admin UI.
//
// IMPORTANT: the admin panel reads the LIVE content file from GitHub (latest
// commit), NOT the copy bundled into the running build. That way an operator
// always edits against the true current state — including a change made minutes
// ago that the production rebuild hasn't shipped yet — and gets the correct sha
// for the next write. The PUBLIC site, by contrast, reads the bundled JSON via
// lib/sermons.ts. (At a few edits/month this GitHub round-trip is negligible.)

import 'server-only';
import { getContentFile } from './github';
import type { ContentFile } from './types';

/** Fetch the live content store (+ blob sha) for admin list/edit screens. */
export async function getAdminContent(): Promise<{ content: ContentFile; sha: string }> {
  return getContentFile();
}

/** How many sermons reference each tag id — drives "in use" state on Manage-tags. */
export function tagUsageCounts(content: ContentFile): Map<string, number> {
  const counts = new Map<string, number>();
  for (const sermon of content.sermons) {
    for (const id of sermon.tags) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The currently featured sermon id, if any. */
export function featuredSermonId(content: ContentFile): string | null {
  return content.sermons.find((s) => s.featured)?.id ?? null;
}
