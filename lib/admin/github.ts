// Read/write the content store via the GitHub Contents API (admin spec §7.1).
//
// Writes ARE git commits: the file's current `sha` is sent with every PUT, so a
// concurrent edit is rejected with 409 (our concurrency control — no locking).
// commitContentMutation re-fetches and re-applies the pure mutation on conflict.
// The commit to data/content.json is what triggers the Vercel production rebuild.

import { githubConfig } from './config';
import type { ContentFile } from './types';

const API = 'https://api.github.com';

export class GithubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

export interface CommitAuthor {
  name: string;
  email: string;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'preachtheword-admin',
  };
}

function contentsUrl(): { url: string; branch: string } {
  const { owner, repo, path, branch } = githubConfig();
  // Keep path slashes intact; encode each segment.
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return { url: `${API}/repos/${owner}/${repo}/contents/${encodedPath}`, branch };
}

/** Fetch the current content file + its blob sha (the live source of truth for admin reads). */
export async function getContentFile(): Promise<{ content: ContentFile; sha: string }> {
  const { token } = githubConfig();
  const { url, branch } = contentsUrl();
  const res = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: headers(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new GithubApiError(
      `GitHub read failed (${res.status}): ${await safeText(res)}`,
      res.status,
    );
  }
  const data = (await res.json()) as { content?: string; encoding?: string; sha: string; download_url?: string };

  let text: string;
  if (data.content && data.encoding === 'base64') {
    text = Buffer.from(data.content, 'base64').toString('utf8');
  } else if (data.download_url) {
    // Files >1MB come back without inline content; fetch the raw blob.
    const raw = await fetch(data.download_url, { cache: 'no-store' });
    text = await raw.text();
  } else {
    throw new GithubApiError('GitHub returned no file content', 500);
  }

  return { content: JSON.parse(text) as ContentFile, sha: data.sha };
}

function serialize(content: ContentFile): string {
  // 2-space pretty-print + trailing newline ⇒ clean, reviewable git diffs.
  return `${JSON.stringify(content, null, 2)}\n`;
}

/** Commit a new version of the content file. Returns the new sha + commit URL. */
export async function commitContentFile(
  content: ContentFile,
  sha: string,
  message: string,
  author: CommitAuthor,
): Promise<{ sha: string; commitUrl: string }> {
  const { token } = githubConfig();
  const { url, branch } = contentsUrl();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(serialize(content), 'utf8').toString('base64'),
      sha,
      branch,
      author,
      committer: author,
    }),
  });
  if (!res.ok) {
    throw new GithubApiError(
      `GitHub write failed (${res.status}): ${await safeText(res)}`,
      res.status,
    );
  }
  const data = (await res.json()) as {
    content: { sha: string };
    commit: { html_url: string };
  };
  return { sha: data.content.sha, commitUrl: data.commit.html_url };
}

/**
 * Fetch → apply a pure mutation → commit, retrying on a 409/422 sha conflict by
 * re-fetching the latest content and re-applying. The mutation must be pure and
 * may throw a business error (ContentError), which is NOT retried.
 */
export async function commitContentMutation<R extends { content: ContentFile }>(
  mutate: (current: ContentFile) => R,
  messageFor: (result: R) => string,
  author: CommitAuthor,
): Promise<{ result: R; sha: string; commitUrl: string }> {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { content: current, sha } = await getContentFile();
    const result = mutate(current); // business errors propagate (not retryable)
    try {
      const committed = await commitContentFile(
        result.content,
        sha,
        messageFor(result),
        author,
      );
      return { result, sha: committed.sha, commitUrl: committed.commitUrl };
    } catch (err) {
      const conflict =
        err instanceof GithubApiError && (err.status === 409 || err.status === 422);
      if (conflict && attempt < MAX_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new GithubApiError(
    'Could not save: the content changed during your edit. Please retry.',
    409,
  );
}

export interface LatestCommit {
  sha: string;
  /** ISO timestamp the commit landed (committer date). */
  committedAt: string;
  url: string;
}

/** The latest commit on the content branch (for release-status detection). */
export async function getLatestCommit(): Promise<LatestCommit> {
  const { token, owner, repo, branch } = githubConfig();
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { headers: headers(token), cache: 'no-store' },
  );
  if (!res.ok) {
    throw new GithubApiError(
      `GitHub commit read failed (${res.status}): ${await safeText(res)}`,
      res.status,
    );
  }
  const data = (await res.json()) as {
    sha: string;
    html_url: string;
    commit?: { committer?: { date?: string }; author?: { date?: string } };
  };
  return {
    sha: data.sha,
    committedAt: data.commit?.committer?.date ?? data.commit?.author?.date ?? '',
    url: data.html_url,
  };
}

export type DeploymentState =
  | 'queued'
  | 'in_progress'
  | 'success'
  | 'failure'
  | 'unknown';

/**
 * The latest GitHub Deployment status for a commit, as posted by Vercel's GitHub
 * integration. Returns null if there's no deployment yet, or if the token can't
 * read deployments — callers should fall back to a time heuristic in that case.
 * Requires the PAT to have "Deployments: Read" for the precise signal.
 */
export async function getDeploymentState(sha: string): Promise<DeploymentState | null> {
  const { token, owner, repo } = githubConfig();
  try {
    const depRes = await fetch(
      `${API}/repos/${owner}/${repo}/deployments?sha=${encodeURIComponent(sha)}&per_page=1`,
      { headers: headers(token), cache: 'no-store' },
    );
    if (!depRes.ok) return null;
    const deployments = (await depRes.json()) as Array<{ id: number }>;
    if (!Array.isArray(deployments) || deployments.length === 0) return null;

    const statusRes = await fetch(
      `${API}/repos/${owner}/${repo}/deployments/${deployments[0].id}/statuses?per_page=1`,
      { headers: headers(token), cache: 'no-store' },
    );
    if (!statusRes.ok) return null;
    const statuses = (await statusRes.json()) as Array<{ state: string }>;
    const state = Array.isArray(statuses) ? statuses[0]?.state : undefined;
    switch (state) {
      case 'success':
        return 'success';
      case 'failure':
      case 'error':
        return 'failure';
      case 'in_progress':
        return 'in_progress';
      case 'queued':
      case 'pending':
        return 'queued';
      default:
        return 'unknown';
    }
  } catch {
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<no body>';
  }
}
