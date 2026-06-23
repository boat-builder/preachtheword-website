// Operator identity + authorization for the admin panel (admin spec §7.4).
//
// Auth is enforced in THREE places: clerkMiddleware gates the /admin routes,
// protected pages call requireOperator(), and every mutating server action calls
// getOperator() before touching the store. The email allowlist (ADMIN_ALLOWED_EMAILS)
// is defense-in-depth on top of Clerk's dashboard sign-up restriction.

import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { allowedEmails } from './config';

export interface Operator {
  userId: string;
  /** Display name, for commit author + Slack message. */
  name: string;
  /** Primary email; used as the git commit author email. */
  email: string;
}

export class UnauthorizedError extends Error {
  constructor(message = 'You are not authorized to access the admin panel.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** The signed-in, allowlisted operator — or null if neither. Never throws. */
export async function getOperator(): Promise<Operator | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email = (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    ''
  ).toLowerCase();

  const allow = allowedEmails();
  if (allow.length > 0 && (!email || !allow.includes(email))) return null;

  const name = user.fullName || user.firstName || email || 'Operator';
  return { userId, name, email: email || 'admin@preachtheword.faith' };
}

/** Like getOperator() but throws UnauthorizedError — for pages/route handlers. */
export async function requireOperator(): Promise<Operator> {
  const operator = await getOperator();
  if (!operator) throw new UnauthorizedError();
  return operator;
}
