import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { SERMONS, THEMES } from '@/lib/sermons';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE.url}/sermons`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE.url}/themes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const themeRoutes: MetadataRoute.Sitemap = THEMES.map((t) => ({
    url: `${SITE.url}/themes/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const sermonRoutes: MetadataRoute.Sitemap = SERMONS.map((s) => ({
    url: `${SITE.url}/sermons/${s.slug}`,
    // Prefer updatedAt so editing a sermon's body (without touching its date)
    // still signals freshness to crawlers; fall back to the content date.
    lastModified: new Date(s.updatedAt ?? s.date),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...themeRoutes, ...sermonRoutes];
}
