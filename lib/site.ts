export const SITE = {
  name: 'Preach the Word',
  /** Canonical production origin. Override with NEXT_PUBLIC_SITE_URL. */
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://preachtheword.faith',
  reference: '2 Timothy 4:2',
  verse: 'Preach the word; be ready in season and out of season.',
  tagline: 'A growing library of messages to discover a word for your need, grow in faith, and share with those you love.',
  description:
    'Preach the Word is a growing library of gospel messages — watch, read, and share sermons on mission, discipleship, future hope, salvation, and repentance.',
  email: 'preachtheword.faith@gmail.com',
} as const;

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
