'use server';

// Mutating server actions — the contract the admin UI imports and calls.
//
// Every action: (1) checks the operator (Clerk + allowlist), (2) validates input
// (zod, for sermon writes), (3) fetches the live store and applies a pure mutation,
// (4) commits to GitHub with optimistic-concurrency retry, (5) posts a Slack note.
// The GitHub commit auto-triggers the Vercel rebuild — there is no revalidation
// code (spec §7.3). Each returns a typed ActionResult; nothing throws to the UI.

import {
  createSermon as applyCreateSermon,
  updateSermon as applyUpdateSermon,
  deleteSermon as applyDeleteSermon,
  setFeatured as applySetFeatured,
  createTag as applyCreateTag,
  renameTag as applyRenameTag,
  setTagRetired as applySetTagRetired,
  deleteTag as applyDeleteTag,
  ContentError,
} from './content';
import {
  commitContentMutation,
  getContentFile,
  getLatestCommit,
  getDeploymentState,
  GithubApiError,
  type CommitAuthor,
} from './github';
import { getOperator, type Operator } from './auth';
import { notifySlack } from './slack';
import {
  sermonInputSchema,
  tagLabelSchema,
  fieldErrorsFromZod,
  type SermonInput,
} from './validation';
import type { ActionResult, ContentFile, ReleaseStatus } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Run a body with the authorized operator, mapping known errors to ActionResult. */
async function withOperator<T>(
  body: (operator: Operator) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const operator = await getOperator();
  if (!operator) {
    return { ok: false, error: 'You are not signed in as an authorized operator.' };
  }
  try {
    return await body(operator);
  } catch (err) {
    if (err instanceof ContentError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    if (err instanceof GithubApiError) {
      return { ok: false, error: err.message };
    }
    console.error('[admin action] unexpected error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error while saving.',
    };
  }
}

const authorOf = (op: Operator): CommitAuthor => ({ name: op.name, email: op.email });

// ---------------------------------------------------------------------------
// Read (for the admin UI to refresh after a mutation)
// ---------------------------------------------------------------------------

/**
 * Live content store for the client controller to re-sync after each write.
 * (The initial load is done server-side in app/admin/page.tsx via getAdminContent;
 * this is the client-callable refresh.)
 */
export async function getContent(): Promise<ActionResult<ContentFile>> {
  const operator = await getOperator();
  if (!operator) {
    return { ok: false, error: 'You are not signed in as an authorized operator.' };
  }
  try {
    const { content } = await getContentFile();
    return { ok: true, data: content };
  } catch (err) {
    if (err instanceof GithubApiError) return { ok: false, error: err.message };
    console.error('[admin action] getContent failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load content.' };
  }
}

// A deploy that hasn't reported a GitHub status yet is treated as "building" for
// this long after the commit (fallback when Deployments: Read isn't granted, or
// before Vercel posts the first status).
const BUILD_WINDOW_MS = 3 * 60 * 1000;

/**
 * Live release status, polled by the admin so an operator doesn't pile up commits
 * (each commit = one production rebuild). Prefers the real GitHub Deployment status
 * (Vercel posts it); falls back to a time window since the latest commit when that
 * signal isn't available. Fail-open: errors return 'unknown' so a transient GitHub
 * hiccup never permanently blocks the admin.
 */
export async function getReleaseStatus(): Promise<ActionResult<ReleaseStatus>> {
  const operator = await getOperator();
  if (!operator) {
    return { ok: false, error: 'You are not signed in as an authorized operator.' };
  }
  try {
    const commit = await getLatestCommit();
    const deployment = await getDeploymentState(commit.sha);

    let state: ReleaseStatus['state'];
    if (deployment === 'success') state = 'live';
    else if (deployment === 'failure') state = 'error';
    else if (deployment === 'in_progress' || deployment === 'queued') state = 'building';
    else {
      // No deployment signal — assume a build is in flight for a short window
      // after the commit landed, then consider it live.
      const age = commit.committedAt
        ? Date.now() - new Date(commit.committedAt).getTime()
        : Number.POSITIVE_INFINITY;
      state = age >= 0 && age < BUILD_WINDOW_MS ? 'building' : 'live';
    }

    return {
      ok: true,
      data: {
        state,
        sha: commit.sha,
        commitUrl: commit.url,
        committedAt: commit.committedAt,
      },
    };
  } catch (err) {
    if (err instanceof GithubApiError) return { ok: false, error: err.message };
    console.error('[admin action] getReleaseStatus failed:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to check release status.',
    };
  }
}

// ---------------------------------------------------------------------------
// Sermons
// ---------------------------------------------------------------------------

export async function createSermon(
  input: SermonInput,
): Promise<ActionResult<{ id: string; slug: string; commitUrl: string }>> {
  return withOperator(async (op) => {
    const parsed = sermonInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'Please fix the errors below.', fieldErrors: fieldErrorsFromZod(parsed.error) };
    }
    const ts = now();
    const { result, commitUrl } = await commitContentMutation(
      (current) => applyCreateSermon(current, parsed.data, ts),
      (r) => `Add sermon: ${r.sermon.title} (${r.sermon.slug})`,
      authorOf(op),
    );
    await notifySlack(
      `:page_facing_up: *${op.name}* published a new sermon "${result.sermon.title}". Live in ~1–2 min. <${commitUrl}|View commit>`,
    );
    return { ok: true, data: { id: result.sermon.id, slug: result.sermon.slug, commitUrl } };
  });
}

export async function updateSermon(
  id: string,
  input: SermonInput,
): Promise<ActionResult<{ slug: string; slugChanged: boolean; commitUrl: string }>> {
  return withOperator(async (op) => {
    const parsed = sermonInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'Please fix the errors below.', fieldErrors: fieldErrorsFromZod(parsed.error) };
    }
    const ts = now();
    const { result, commitUrl } = await commitContentMutation(
      (current) => applyUpdateSermon(current, id, parsed.data, ts),
      (r) =>
        r.slugChanged
          ? `Edit sermon: ${r.sermon.title} (slug → ${r.sermon.slug})`
          : `Edit sermon: ${r.sermon.title} (${r.sermon.slug})`,
      authorOf(op),
    );
    await notifySlack(
      `:pencil2: *${op.name}* edited "${result.sermon.title}"${result.slugChanged ? ' (slug changed — a 301 redirect was added)' : ''}. Live in ~1–2 min. <${commitUrl}|View commit>`,
    );
    return {
      ok: true,
      data: { slug: result.sermon.slug, slugChanged: result.slugChanged, commitUrl },
    };
  });
}

export async function deleteSermon(
  id: string,
  replacementFeaturedId?: string,
): Promise<ActionResult<{ commitUrl: string }>> {
  return withOperator(async (op) => {
    const ts = now();
    const { commitUrl } = await commitContentMutation(
      (current) => applyDeleteSermon(current, id, ts, replacementFeaturedId),
      () => `Delete sermon (${id})`,
      authorOf(op),
    );
    await notifySlack(
      `:wastebasket: *${op.name}* deleted a sermon. Live in ~1–2 min. <${commitUrl}|View commit>`,
    );
    return { ok: true, data: { commitUrl } };
  });
}

export async function setFeaturedSermon(
  id: string,
): Promise<ActionResult<{ commitUrl: string }>> {
  return withOperator(async (op) => {
    const ts = now();
    const { result, commitUrl } = await commitContentMutation(
      (current) => applySetFeatured(current, id, ts),
      (r) => `Feature sermon: ${r.sermon.title}`,
      authorOf(op),
    );
    await notifySlack(
      `:star: *${op.name}* set "${result.sermon.title}" as the featured message. Live in ~1–2 min. <${commitUrl}|View commit>`,
    );
    return { ok: true, data: { commitUrl } };
  });
}

// ---------------------------------------------------------------------------
// Tags (Manage-tags screen)
// ---------------------------------------------------------------------------

export async function createTag(
  label: string,
): Promise<ActionResult<{ id: string; label: string; commitUrl: string }>> {
  return withOperator(async (op) => {
    const parsed = tagLabelSchema.safeParse(label);
    if (!parsed.success) {
      return { ok: false, error: 'Please fix the errors below.', fieldErrors: fieldErrorsFromZod(parsed.error) };
    }
    const { result, commitUrl } = await commitContentMutation(
      (current) => applyCreateTag(current, parsed.data),
      (r) => `Add tag: ${r.tag.label}`,
      authorOf(op),
    );
    return { ok: true, data: { id: result.tag.id, label: result.tag.label, commitUrl } };
  });
}

export async function renameTag(
  id: string,
  label: string,
): Promise<ActionResult<{ id: string; label: string; commitUrl: string }>> {
  return withOperator(async (op) => {
    const parsed = tagLabelSchema.safeParse(label);
    if (!parsed.success) {
      return { ok: false, error: 'Please fix the errors below.', fieldErrors: fieldErrorsFromZod(parsed.error) };
    }
    const { result, commitUrl } = await commitContentMutation(
      (current) => applyRenameTag(current, id, parsed.data),
      (r) => `Rename tag → ${r.tag.label}`,
      authorOf(op),
    );
    return { ok: true, data: { id: result.tag.id, label: result.tag.label, commitUrl } };
  });
}

export async function setTagRetired(
  id: string,
  retired: boolean,
): Promise<ActionResult<{ id: string; commitUrl: string }>> {
  return withOperator(async (op) => {
    const { result, commitUrl } = await commitContentMutation(
      (current) => applySetTagRetired(current, id, retired),
      (r) => `${retired ? 'Retire' : 'Restore'} tag: ${r.tag.label}`,
      authorOf(op),
    );
    return { ok: true, data: { id: result.tag.id, commitUrl } };
  });
}

export async function deleteTag(
  id: string,
): Promise<ActionResult<{ commitUrl: string }>> {
  return withOperator(async (op) => {
    const { commitUrl } = await commitContentMutation(
      (current) => applyDeleteTag(current, id),
      () => `Delete tag (${id})`,
      authorOf(op),
    );
    return { ok: true, data: { commitUrl } };
  });
}
