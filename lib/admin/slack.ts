// Optional Slack notification on each admin save (admin spec §7.3). Posts to an
// incoming webhook. Failures are swallowed — a Slack hiccup must never fail or
// block a content save.

import { slackWebhookUrl } from './config';

export async function notifySlack(text: string): Promise<void> {
  const url = slackWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[admin] Slack notification failed (ignored):', err);
  }
}
