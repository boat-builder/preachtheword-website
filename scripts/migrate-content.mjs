// One-off migration: turn the static SERMONS array in lib/sermons.ts into the
// git-backed content store at data/content.json (see admin spec §7.1 / Appendix A).
//
// Run with:  node scripts/migrate-content.mjs
//
// It is idempotent-ish: it always regenerates data/content.json from the current
// lib/sermons.ts. Safe to delete after the migration has been committed once, but
// kept in the repo as documentation of how the seed data was produced.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../lib/admin/slugify.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Node 23+ strips types; lib/sermons.ts imports nothing, so this works directly.
const { SERMONS } = await import(resolve(root, 'lib/sermons.ts'));

// ---------------------------------------------------------------------------
// 1. Build the controlled tag vocabulary from every distinct label in use.
// ---------------------------------------------------------------------------
const tagIdByLabel = new Map(); // label -> id
const tags = []; // { id, label }

for (const sermon of SERMONS) {
  for (const label of sermon.tags) {
    if (tagIdByLabel.has(label)) continue;
    // Stable kebab id, de-duplicated against ids already taken.
    let base = slugify(label);
    let id = base;
    let n = 2;
    const taken = new Set(tags.map((t) => t.id));
    while (taken.has(id)) id = `${base}-${n++}`;
    tagIdByLabel.set(label, id);
    tags.push({ id, label });
  }
}

// ---------------------------------------------------------------------------
// 2. Re-shape sermons: tags become id references; add updatedAt.
// ---------------------------------------------------------------------------
const sermons = SERMONS.map((s) => {
  const record = {
    id: s.id,
    slug: s.slug,
    videoId: s.videoId,
    title: s.title,
    ref: s.ref,
    date: s.date,
    category: s.category,
    tags: s.tags.map((label) => tagIdByLabel.get(label)),
    short: s.short,
    long: s.long,
  };
  if (s.transcript) record.transcript = s.transcript;
  if (s.featured) record.featured = true;
  if (s.preacher) record.preacher = s.preacher;
  // Seed updatedAt from the content date (09:00 UTC) — feeds sitemap freshness.
  record.updatedAt = `${s.date}T09:00:00Z`;
  return record;
});

// ---------------------------------------------------------------------------
// 3. Write data/content.json.
// ---------------------------------------------------------------------------
const content = { sermons, tags, redirects: [] };

const outDir = resolve(root, 'data');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'content.json');
writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n', 'utf8');

console.log(
  `Wrote ${outPath}\n  ${sermons.length} sermons, ${tags.length} tags, ${content.redirects.length} redirects`,
);
