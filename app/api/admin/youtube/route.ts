import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/admin/auth';
import { prefillFromVideo } from '@/lib/admin/youtube';

// Auth-gated YouTube prefill endpoint, called from the create/edit form when the
// operator pastes a link. Keyless oEmbed always runs (title/thumbnail/existence);
// the Data API adds date/description when YOUTUBE_API_KEY is configured (spec §4).
//
//   GET /api/admin/youtube?url=<youtube url or 11-char id>
//
// The Data API key never leaves the server — that's why this is a route handler
// rather than a direct browser fetch to YouTube.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get('url')?.trim();
  if (!url) {
    return NextResponse.json({ error: 'Missing ?url parameter' }, { status: 400 });
  }

  const prefill = await prefillFromVideo(url);
  if (!prefill) {
    return NextResponse.json(
      { error: 'Could not parse a YouTube video id from that link.' },
      { status: 422 },
    );
  }

  return NextResponse.json(prefill);
}
