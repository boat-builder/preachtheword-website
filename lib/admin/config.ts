// Server-side configuration for the admin panel. All secrets are read from
// environment variables and NEVER exposed to the browser. Getters that need a
// required secret throw a clear error *when called* (not at import time), so the
// public site still builds without any admin env vars set.

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Path of the content file within the repo. */
  path: string;
}

// Fixed repo coordinates — not configurable (this app only ever writes to its own
// content file on the production branch). Only the token is a secret read from env.
const GITHUB_REPO = {
  owner: 'boat-builder',
  repo: 'preachtheword-website',
  branch: 'main',
  path: 'data/content.json',
} as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env.local (and in Vercel) — see .env.example.`,
    );
  }
  return value;
}

/** GitHub repo coordinates + token used to commit data/content.json. */
export function githubConfig(): GithubConfig {
  return { token: required('GITHUB_TOKEN'), ...GITHUB_REPO };
}

/** Optional Slack incoming-webhook URL for post-save notifications. */
export function slackWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL || undefined;
}

/** Optional YouTube Data API key (enables auto-fill of publish date/description). */
export function youtubeApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY || undefined;
}

/**
 * Allowlist of operator emails (defense-in-depth on top of Clerk's dashboard
 * sign-up restriction). Empty ⇒ any signed-in Clerk user is allowed.
 */
export function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
