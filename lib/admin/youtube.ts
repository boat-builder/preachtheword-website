// YouTube auto-fill helpers (admin spec §4).
//
// - extractVideoId: pure parser — accepts a full URL or a bare 11-char id.
// - oEmbed (keyless): confirms the video exists + gives title/author/thumbnail.
// - Data API v3 (needs YOUTUBE_API_KEY): adds publishedAt (→ date), description,
//   and contentDetails.duration (→ durationSeconds).

import { youtubeApiKey } from './config';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Extract the 11-char video id from a URL or bare id. Returns null if none. */
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      candidate = m?.[1] ?? null;
    }
  }

  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;
}

const TIMEOUT_MS = 8000;

export interface VideoPrefill {
  videoId: string;
  title?: string;
  /** Channel/author name (informational; not stored). */
  channel?: string;
  thumbnailUrl?: string;
  /** YYYY-MM-DD — only available via the Data API. */
  date?: string;
  /** Video length in whole seconds — only available via the Data API. */
  durationSeconds?: number;
  /** Full description — only via the Data API; UI may seed short/long from it. */
  description?: string;
  /** Where the metadata came from. */
  source: 'oembed' | 'data-api';
  /** True when oEmbed confirmed the video resolves/embeds. */
  resolved: boolean;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Keyless oEmbed lookup: title, author, thumbnail; confirms the video exists. */
async function fetchOEmbed(videoId: string) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://youtu.be/${videoId}`,
  )}&format=json`;
  const data = (await getJson(url)) as
    | { title?: string; author_name?: string; thumbnail_url?: string }
    | null;
  if (!data) return null;
  return {
    title: data.title,
    channel: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  };
}

/** Parse a YouTube ISO 8601 duration ("PT1H2M33S") into whole seconds. */
function parseIso8601Duration(iso: string): number | undefined {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!m) return undefined;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : undefined;
}

/** Data API lookup (needs a key): title, description, publishedAt, duration. */
async function fetchDataApi(videoId: string, key: string) {
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails` +
    `&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
  const data = (await getJson(url)) as
    | {
        items?: Array<{
          snippet?: { title?: string; description?: string; publishedAt?: string };
          contentDetails?: { duration?: string };
        }>;
      }
    | null;
  const item = data?.items?.[0];
  const snippet = item?.snippet;
  if (!snippet) return null;
  return {
    title: snippet.title,
    description: snippet.description,
    date: snippet.publishedAt ? snippet.publishedAt.slice(0, 10) : undefined,
    durationSeconds: item?.contentDetails?.duration
      ? parseIso8601Duration(item.contentDetails.duration)
      : undefined,
  };
}

/**
 * Prefill what we can from a pasted URL/id: always oEmbed (title/thumbnail/
 * existence); plus the Data API (date/description) when a key is configured.
 */
export async function prefillFromVideo(input: string): Promise<VideoPrefill | null> {
  const videoId = extractVideoId(input);
  if (!videoId) return null;

  const oembed = await fetchOEmbed(videoId);
  const result: VideoPrefill = {
    videoId,
    source: 'oembed',
    resolved: Boolean(oembed),
    title: oembed?.title,
    channel: oembed?.channel,
    thumbnailUrl: oembed?.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  const key = youtubeApiKey();
  if (key) {
    const api = await fetchDataApi(videoId, key);
    if (api) {
      result.source = 'data-api';
      result.title = api.title ?? result.title;
      result.description = api.description;
      result.date = api.date;
      result.durationSeconds = api.durationSeconds;
    }
  }

  return result;
}
