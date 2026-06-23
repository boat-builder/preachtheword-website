# Making the admin panel work in practice

One-time setup to get `/admin` live. The **public site builds and runs without any of
this** — these steps only enable the admin. Slack + YouTube are optional and can wait.

You'll create two secrets (a GitHub token and Clerk keys), set a handful of env vars
locally and in Vercel, and invite your operator email(s) in Clerk.

---

## 1. GitHub token (content writes + release status)

Each save commits `data/content.json` via the GitHub API, which triggers the Vercel rebuild.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
2. **Resource owner:** `boat-builder`. **Repository access:** *Only select repositories* →
   `preachtheword-website`.
3. **Repository permissions:**
   - **Contents → Read and write** (required — commits the content file)
   - **Deployments → Read** (optional — drives the live "Releasing…" banner; without it the
     admin shows "Releasing…" for ~3 minutes after a save via a timer instead)
   - *Metadata → Read* is added automatically.
4. Generate, copy the `github_pat_…` value → this is **`GITHUB_TOKEN`**.

## 2. Clerk (operator login)

1. <https://dashboard.clerk.com> → **Create application** (name it e.g. "Preach the Word").
2. **Sign-in options:** enable **Email** with **Email verification code** (and/or magic link).
   You can turn passwords off — operators just get a code by email.
3. **API keys** → copy:
   - Publishable key (`pk_…`) → **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**
   - Secret key (`sk_…`) → **`CLERK_SECRET_KEY`**
4. **Restrict sign-up:** Configure → **Restrictions** → set sign-up to **restricted /
   invitation-only** so the public can't create accounts.
5. **Invite operators:** **Users → Invite** (or add to the allowlist) the 1–2 operator emails.
   Only invited emails can sign in.

## 3. Set environment variables

Copy `.env.example` → `.env.local` for local dev, and add the **same keys** in Vercel
(**Project → Settings → Environment Variables**, scope to Production + Preview + Development).

**Required:**

```
GITHUB_TOKEN=github_pat_…
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…
CLERK_SECRET_KEY=sk_…
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/admin/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/admin/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/admin
NEXT_PUBLIC_SITE_URL=https://preachtheword.faith
```

**Recommended (defense-in-depth — only these emails may use the admin even with a session):**

```
ADMIN_ALLOWED_EMAILS=operator1@example.com,operator2@example.com
```

**Optional, can be left blank for now:** `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`,
`GITHUB_CONTENT_BRANCH`, `GITHUB_CONTENT_PATH` (sensible defaults are baked in),
`SLACK_WEBHOOK_URL`, `YOUTUBE_API_KEY` (later).

## 4. Confirm Vercel ↔ GitHub

Make sure the Vercel project is connected to `boat-builder/preachtheword-website` with the
**production branch = `main`**. That's what makes a commit to `data/content.json` trigger a
production rebuild. (Usually already set when the project was imported.)

## 5. Deploy & verify

1. Deploy (merge to `main` or push, and add the env vars in Vercel first).
2. Visit `/admin` → you're redirected to the Clerk sign-in → enter an invited operator email →
   type the emailed code → you land on the admin.
3. Add or edit a sermon. You'll see **"Releasing…"** and new edits pause; ~1–2 minutes later
   the change is live on the site and the banner clears.

---

### Quick reference: which secret powers what

| Capability | Needs |
| --- | --- |
| Save/edit/delete sermons + tags (commits) | `GITHUB_TOKEN` (Contents: R/W) |
| Live "Releasing…" status | `GITHUB_TOKEN` (Deployments: Read) — degrades to a timer without it |
| Admin login / who can sign in | Clerk keys + dashboard invite/restrict |
| Auto-fill sermon date from YouTube | `YOUTUBE_API_KEY` (optional, later) |
| Slack ping on each save | `SLACK_WEBHOOK_URL` (optional, later) |
