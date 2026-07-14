import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Defense-in-depth on top of Clerk itself: even though the Clerk instance
 * should be configured with sign-ups disabled and exactly two invited
 * accounts, this makes sure only the email addresses listed in
 * ALLOWED_EMAILS can ever see the board.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
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

/**
 * Call from every protected server component / route handler. Redirects
 * unauthenticated users to sign-in and non-allowlisted users to a friendly
 * "this is private" page.
 */
export async function requireAllowedUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const allowed = allowedEmails();
  const email = user.primaryEmailAddress?.emailAddress.toLowerCase();
  if (allowed.length > 0 && (!email || !allowed.includes(email))) {
    redirect("/not-authorized");
  }

  return { userId, user, name: authorName(user) };
}
