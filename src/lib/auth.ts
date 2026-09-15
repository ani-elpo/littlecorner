import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Defense-in-depth on top of Clerk itself: even though the Clerk instance
 * should be configured with sign-ups disabled and exactly two invited
 * accounts, this makes sure only the email addresses listed in
 * ALLOWED_EMAILS can ever see the board.
 */
function normalizeEmail(raw: string): string {
  return raw
    .trim()
    // Strip wrapping quotes, e.g. from ALLOWED_EMAILS="a@x.com,b@x.com"
    // being pasted into a dashboard field with the quotes left in.
    .replace(/^["']|["']$/g, "")
    .trim()
    .toLowerCase();
}

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    // Accept commas, semicolons, or newlines as separators.
    .split(/[,;\n]/)
    .map(normalizeEmail)
    .filter(Boolean);
}

export function authorName(user: {
  firstName?: string | null;
  fullName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
}): string {
  return (
    user.firstName ||
    user.fullName ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Someone"
  );
}

async function resolveAllowedUser() {
  const { userId } = await auth();
  if (!userId) return { status: "unauthenticated" as const };

  const user = await currentUser();
  if (!user) return { status: "unauthenticated" as const };

  const allowed = allowedEmails();
  // Check every email on the account, not just whichever one is marked
  // primary - someone can be invited at an address that isn't primary.
  const userEmails = user.emailAddresses.map((e) => normalizeEmail(e.emailAddress));
  const isAllowed = allowed.length === 0 || userEmails.some((e) => allowed.includes(e));
  if (!isAllowed) return { status: "forbidden" as const };

  return { status: "ok" as const, userId, user, name: authorName(user) };
}

/**
 * Call from every protected server component. Redirects unauthenticated
 * users to sign-in and non-allowlisted users to a friendly "this is
 * private" page.
 */
export async function requireAllowedUser() {
  const result = await resolveAllowedUser();
  if (result.status === "unauthenticated") redirect("/sign-in");
  if (result.status === "forbidden") redirect("/not-authorized");

  return { userId: result.userId, user: result.user, name: result.name };
}

/**
 * Call from route handlers (API routes), where redirecting isn't
 * appropriate - returns null instead of redirecting so the caller can
 * respond with a JSON 401.
 */
export async function getAllowedUser() {
  const result = await resolveAllowedUser();
  if (result.status !== "ok") return null;

  return { userId: result.userId, name: result.name };
}
