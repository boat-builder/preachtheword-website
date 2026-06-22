# Preach the Word

A sermon distribution platform — a growing library of gospel messages to watch,
read, and share. Built with **Next.js (App Router)** and recreated pixel-for-pixel
from the Claude Design handoff in [`sermon-discovery-platform/`](sermon-discovery-platform/).

## Why every sermon and theme is its own page

SEO is the point. Each message and each theme is a **statically generated,
individually addressable page** with its own metadata, canonical URL, Open Graph
tags, and JSON-LD structured data — so search engines (and rich results, e.g.
video) can index them directly.

## Routes

| Route               | Rendering | Purpose                                            |
| ------------------- | --------- | -------------------------------------------------- |
| `/`                 | Static    | Home — featured message, need-tags, themes, latest |
| `/sermons`          | Dynamic   | Browse all + search (`?q=`) / tag filter (`?tag=`) |
| `/sermons/[slug]`   | SSG       | **Individual sermon** + `VideoObject` JSON-LD      |
| `/themes`           | Static    | Themes index                                       |
| `/themes/[theme]`   | SSG       | **Individual theme** + `CollectionPage` JSON-LD    |
| `/sitemap.xml`      | Static    | All indexable URLs                                 |
| `/robots.txt`       | Static    | Crawl rules → sitemap                              |

Filtered `/sermons?q=…` / `?tag=…` views are marked `noindex` so only the
canonical library page is indexed.

## Structure

- `lib/sermons.ts` — sermon + theme data (currently static) and all lookup/search helpers.
- `lib/site.ts` — site-wide constants (name, canonical URL, verse, contact).
- `app/` — routes, layout, SEO files (`sitemap.ts`, `robots.ts`).
- `components/` — `Header`, `Footer`, `SermonCard`, `ThemeCard`, `ShareControls`,
  `Transcript`, `ToastProvider`, etc. Styling is CSS Modules + design tokens in
  `app/globals.css`. Fonts (`Newsreader`, `Public Sans`) are self-hosted via `next/font`.

## Configuration

Set the canonical production origin (used for canonical URLs, OG tags, sitemap,
and share links). Defaults to `https://preachtheword.faith`:

```bash
# .env.local
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + static generation
npm run start    # serve the production build
```

## Adding a sermon

Append an entry to `SERMONS` in `lib/sermons.ts` (give it a stable `slug` and a
YouTube `videoId`). The sermon page, theme listing, search index, and sitemap all
pick it up automatically on the next build.
