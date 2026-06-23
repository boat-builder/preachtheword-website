# Admin backend & integrations

This document is the handoff for wiring the (separately-built) admin UI to the backend.
It covers the architecture, the setup you need to do (env vars, Clerk, GitHub), and the
exact contract the UI imports: **server actions**, a **read helper**, and a **YouTube prefill
endpoint**.

> TL;DR for the UI dev: import the server actions from `@/lib/admin/actions`, read live
> data with `getAdminContent()` from `@/lib/admin/read`, and don't build a login page —
> mount Clerk's `<SignIn />` (already done at `/admin/sign-in`). Jump to
> [§4 Integration contract](#4-integration-contract-for-the-ui).

---

## 1. Architecture

- **Data store:** all content lives in [`data/content.json`](../data/content.json) —
  `sermons[]`, `tags[]` (controlled vocabulary), and `redirects[]`. There is **no database**.
- **Reads (public site):** `lib/sermons.ts` imports that JSON at build time and hydrates
  tag **ids → labels**, keeping every existing helper synchronous. The site stays 100% static.
- **Reads (admin):** the admin reads the **live** file from GitHub (latest commit) so an
  operator always edits the true current state and gets the correct `sha` for the next write.
- **Writes:** every save/delete is a **GitHub commit** to `data/content.json` via the
  Contents API. The commit **auto-triggers a Vercel production rebuild**, which re-runs
  `generateStaticParams` over the new JSON. **No revalidation code, no ISR** — change is live
  in ~1–2 minutes.
- **Concurrency:** the file's `sha` is sent with each commit. A concurrent edit → GitHub 409
  → we re-fetch and re-apply automatically (up to 4 attempts). No locking.
- **Auth:** Clerk (email code / magic link). Gated in middleware **and** re-checked in every
  server action / route handler. An optional email allowlist adds defense-in-depth.

```
UI form ──► server action ──► validate (zod) ──► fetch live JSON+sha (GitHub)
                                                       │
                                                       ▼
                              apply pure mutation ──► commit to GitHub ──► Vercel rebuild ──► live
                                                       │
                                                       └─► Slack notification (optional)
```

### Files added (`lib/admin/`)

| File | Responsibility |
| --- | --- |
| `types.ts` | Storage types: `ContentFile`, `SermonRecord`, `TagRecord`, `Redirect`, `ActionResult`. |
| `slugify.ts` | `slugify`, `uniqueSlug` (transliterates curly punctuation). |
| `validation.ts` | zod schemas (`sermonInputSchema`, `tagLabelSchema`), `SermonInput` type, `splitParagraphs`. |
| `content.ts` | **Pure** mutation functions + all business rules (slug/redirect, single-featured, tag rules). |
| `github.ts` | GitHub Contents API read/write + `commitContentMutation` (409 retry). |
| `youtube.ts` | `extractVideoId` + `prefillFromVideo` (oEmbed + optional Data API). |
| `slack.ts` | `notifySlack` (optional, never blocks a save). |
| `auth.ts` | `getOperator` / `requireOperator` (Clerk + allowlist). **server-only.** |
| `read.ts` | `getAdminContent`, `tagUsageCounts`, `featuredSermonId`. **server-only.** |
| `actions.ts` | `'use server'` — the mutation contract the UI calls. |

Other touched files: `middleware.ts` (Clerk gate), `app/layout.tsx` (`<ClerkProvider>`),
`app/admin/sign-in/[[...sign-in]]/page.tsx` (Clerk `<SignIn />`), `app/api/admin/youtube/route.ts`,
`next.config.mjs` (`redirects()` from the store), `app/sitemap.ts` (`updatedAt` freshness),
`app/robots.ts` (disallow `/admin`), `app/page.tsx` (`HOME_TAGS`), `lib/sermons.ts` (JSON-backed).

---

## 2. Setup checklist (your tasks)

1. **Copy env vars:** `cp .env.example .env.local`, fill them in, and add the same keys in
   **Vercel → Project → Settings → Environment Variables**. See [`.env.example`](../.env.example).
2. **GitHub token:** create a **fine-grained PAT** scoped to *only* `preachtheword-website`
   with **Contents: Read and write**. Put it in `GITHUB_TOKEN`. (A GitHub App token also works.)
3. **Clerk dashboard:**
   - Create an application; copy the publishable + secret keys into `.env.local`/Vercel.
   - Enable **Email verification code** (and/or magic link). Disable passwords if you like.
   - **Disable public sign-up** (Restrictions → Sign-up mode → restricted / invitation only).
   - **Invite** the 1–2 operator emails.
   - Optionally also set `ADMIN_ALLOWED_EMAILS` to those same emails for belt-and-suspenders.
4. **Slack (optional):** create an incoming webhook, set `SLACK_WEBHOOK_URL`.
5. **YouTube (optional):** create a Data API v3 key, set `YOUTUBE_API_KEY` — this is what
   makes the publish **date** auto-fill. Without it, title + thumbnail still auto-fill and
   the date is a manual picker.

The public site builds and runs **without any of these** — they're only needed for `/admin`.

---

## 3. The data model (what the UI works with)

The admin works with the **storage shape** (`SermonRecord`), where `tags` are tag **ids**:

```ts
// data/content.json — see lib/admin/types.ts for the full types
interface SermonRecord {
  id: string;          // system-generated, never changes
  slug: string;        // the public URL segment
  videoId: string;     // 11-char YouTube id
  title: string; ref: string; date: string;       // date = "YYYY-MM-DD"
  category: ThemeKey;  // 'mission' | 'discipleship' | 'future' | 'salvation' | 'repentance'
  tags: string[];      // TagRecord.id references (NOT labels)
  short: string; long: string[]; transcript?: string;
  featured?: boolean;  // at most one true
  preacher?: string;   // not editable, not shown (D3)
  updatedAt?: string;
}
interface TagRecord { id: string; label: string; retired?: boolean }
```

To show tag labels in the UI, map ids through `content.tags`. The 5 themes are a fixed code
enum — get their display names from `THEMES` in `@/lib/sermons` (don't build theme CRUD).

---

## 4. Integration contract (for the UI)

### 4a. Reading data — `@/lib/admin/read` (call from server components)

```ts
import { getAdminContent, tagUsageCounts, featuredSermonId } from '@/lib/admin/read';

export default async function SermonsListPage() {
  const { content } = await getAdminContent();      // live from GitHub (+ sha)
  const usage = tagUsageCounts(content);            // Map<tagId, count> for Manage-tags
  const featuredId = featuredSermonId(content);     // highlight the current hero
  // content.sermons / content.tags / content.redirects
}
```

> These are `server-only`. Call them in server components (the list/edit pages), pass plain
> data to client form components.

### 4b. Mutations — `@/lib/admin/actions` (importable from client or server)

Every action returns `ActionResult<T>` — it never throws to the UI:

```ts
type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

`fieldErrors` is keyed by field name (`title`, `slug`, `tags`, `replacementFeaturedId`, `label`, …)
so you can render messages inline.

| Action | Signature | Returns `data` |
| --- | --- | --- |
| `createSermon` | `(input: SermonInput)` | `{ id, slug, commitUrl }` |
| `updateSermon` | `(id: string, input: SermonInput)` | `{ slug, slugChanged, commitUrl }` |
| `deleteSermon` | `(id: string, replacementFeaturedId?: string)` | `{ commitUrl }` |
| `setFeaturedSermon` | `(id: string)` | `{ commitUrl }` |
| `createTag` | `(label: string)` | `{ id, label, commitUrl }` |
| `renameTag` | `(id: string, label: string)` | `{ id, label, commitUrl }` |
| `setTagRetired` | `(id: string, retired: boolean)` | `{ id, commitUrl }` |
| `deleteTag` | `(id: string)` | `{ commitUrl }` |

**`SermonInput`** (from `@/lib/admin/validation`) — the form payload. The backend is forgiving:

```ts
{
  videoId: string;        // full YouTube URL *or* 11-char id — extracted server-side
  title: string;
  short: string;          // ≤ ~160 recommended (meta description); hard cap 300
  long: string | string[];// single textarea (split on blank lines) OR pre-split paragraphs
  transcript?: string;    // newlines preserved; empty ⇒ omitted from page + JSON-LD
  tags?: string[];        // tag IDS from the vocabulary (pick-only)
  category: ThemeKey;
  slug?: string;          // omit ⇒ auto from title; provide ⇒ override (validated + unique)
  date: string;           // "YYYY-MM-DD"
  ref: string;
  featured?: boolean;
}
```

Example client usage:

```tsx
'use client';
import { createSermon } from '@/lib/admin/actions';

async function onSubmit(form: SermonInput) {
  const res = await createSermon(form);
  if (!res.ok) return showErrors(res.error, res.fieldErrors);
  toast(`Saved — live in a minute or two.`);
  router.push('/admin');           // re-render reads fresh data from GitHub
}
```

> After a successful mutation, just re-navigate / re-fetch — `getAdminContent()` is
> `no-store`, so the next render shows the new state. (The public site updates after the
> Vercel rebuild, ~1–2 min later.)

### 4c. YouTube prefill — `GET /api/admin/youtube?url=<link or id>`

Call this on paste in the create/edit form. Auth-gated (operator session required).

```jsonc
// 200 OK
{
  "videoId": "XhiPW7-m7vs",
  "title": "…",            // prefill title (then slugify → slug)
  "channel": "…",          // informational
  "thumbnailUrl": "https://i.ytimg.com/…",  // show as confirmation
  "date": "2026-06-15",    // ONLY if YOUTUBE_API_KEY is set
  "description": "…",      // ONLY with the key; seed short/long if you like
  "resolved": true,         // oEmbed confirmed the video exists/embeds
  "source": "data-api"      // or "oembed"
}
```

### 4d. Auth wiring (your admin layout)

`<ClerkProvider>` is already in the root layout, and `/admin/sign-in` already mounts Clerk's
`<SignIn />` — **do not build a custom login page.** In your `app/admin/layout.tsx`, gate the
section server-side and add a sign-out control:

```tsx
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { getOperator } from '@/lib/admin/auth';

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const operator = await getOperator();
  if (!operator) redirect('/admin/sign-in');   // middleware also enforces this
  return (
    <div>
      <header>{operator.name}<UserButton /></header>
      {children}
    </div>
  );
}
```

---

## 5. UX rules the UI must surface (from the spec)

These are enforced server-side, but the UI should guide the operator so saves don't bounce:

- **Tags are pick-only** in the sermon form (multi-select bound to `content.tags`, hide
  `retired` ones). New tags are created only on the **Manage tags** screen.
- **`featured` is a collection-level radio**, not a per-row checkbox — exactly one hero.
- **Editing an existing slug is destructive:** confirm ("this changes the public URL; a 301
  redirect will be added"). A create-time slug edit is fine. `updateSermon` returns
  `slugChanged: true` when it happened.
- **Deleting the featured sermon** must prompt for a replacement hero and pass it as
  `deleteSermon(id, replacementId)` — otherwise the action returns a `replacementFeaturedId`
  field error.
- **`long`** → repeatable paragraph inputs or one textarea (blank lines split paragraphs).
  **`transcript`** → plain multiline textarea (NOT rich text — newlines must survive).
- **`date`** → date picker; pre-fill from `/api/admin/youtube` when `YOUTUBE_API_KEY` is set.

---

## 6. Notes & gotchas

- **Home chips changed behavior:** the "Looking for a word on…" chips now render from the tag
  vocabulary (`HOME_TAGS` = non-retired tags attached to ≥1 sermon, most-used first) instead of
  a hard-coded list of 8. With current data that's all 23 tags. Curate via **Manage tags**
  (retire to hide). Chip overflow styling is a future design concern (spec §2.1).
- **`middleware.ts` deprecation:** Next 16 prints a warning suggesting `proxy.ts`. The
  middleware still runs correctly (shown as "Proxy (Middleware)" in build output). Keeping
  `middleware.ts` because that's what Clerk's `clerkMiddleware` targets today; rename once
  Clerk documents `proxy.ts` support.
- **The site stays static.** Verified: `/`, `/sermons/[slug]`, `/themes/[theme]` prerender;
  only `/admin/*`, `/api/admin/*`, and the (pre-existing) `/sermons` search page are dynamic.
- **`scripts/migrate-content.mjs`** produced the initial `data/content.json` from the old
  static array. It's kept for reference; you won't need to run it again.
