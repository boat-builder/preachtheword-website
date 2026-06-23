import content from './data/content.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  // 301s for slugs that have changed (old → new), emitted from the content store.
  // The same admin commit that renames a slug appends the redirect entry, so the
  // rebuild picks it up automatically. Keeps shared/indexed links alive (spec §8).
  async redirects() {
    return (content.redirects ?? []).map((r) => ({
      source: r.from,
      destination: r.to,
      permanent: true,
    }));
  },
};

export default nextConfig;
