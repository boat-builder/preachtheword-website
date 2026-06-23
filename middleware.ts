import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Gate the admin panel + its API. The sign-in route stays public so unauthenticated
// operators can actually reach the login screen. Auth is ALSO enforced server-side
// in every action/route handler (see lib/admin/auth.ts) — this is the first line.
const isProtectedRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);
const isPublicAdminRoute = createRouteMatcher(['/admin/sign-in(.*)']);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req) && !isPublicAdminRoute(req)) {
      await auth.protect();
    }
  },
  { signInUrl: '/admin/sign-in' },
);

export const config = {
  matcher: [
    // Run on app routes, skipping Next internals and static assets…
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // …and always on API routes.
    '/(api|trpc)(.*)',
  ],
};
