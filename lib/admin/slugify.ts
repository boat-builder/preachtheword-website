// Turn arbitrary text into a URL-safe, ASCII kebab-case slug.
//
// Must satisfy the slug validation regex used everywhere: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// and transliterate curly punctuation, e.g. "God's Open Secret" -> "gods-open-secret".

export function slugify(input: string): string {
  return input
    .normalize('NFKD') // decompose accented letters (é -> e + ´)
    .replace(/[̀-ͯ]/g, '') // strip the diacritic marks
    .replace(/['’‘`´ʼ]/g, '') // drop apostrophes so "God's" -> "gods", not "god-s"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics -> single hyphen
    .replace(/-{2,}/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * Generate a slug from `desired` (or `fallback` text) that does not collide with
 * any slug in `taken`. Appends -2, -3, … on collision.
 */
export function uniqueSlug(
  desired: string,
  taken: Iterable<string>,
  fallback = 'sermon',
): string {
  const base = slugify(desired) || slugify(fallback) || 'sermon';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
