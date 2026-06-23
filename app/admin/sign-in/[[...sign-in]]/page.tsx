import { SignIn } from '@clerk/nextjs';

// Clerk's prebuilt sign-in UI (email code / magic link — configured in the Clerk
// dashboard). This REPLACES the auth page from the UX mockup; the UI dev does not
// build a custom login form. Public sign-up is disabled in the dashboard, so only
// invited operator emails can sign in.
//
// Not prerendered (Clerk needs runtime keys) and excluded from indexing/sitemap.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function AdminSignInPage() {
  return (
    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '4rem 1rem',
      }}
    >
      <SignIn />
    </main>
  );
}
