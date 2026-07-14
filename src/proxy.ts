import { clerkMiddleware } from "@clerk/nextjs/server";

// Establishes Clerk's auth context for every request. Actual protection is
// resource-based (see requireAllowedUser() in src/lib/auth.ts, called from
// every protected page and server action) rather than path-matching here,
// per Clerk's current guidance - middleware-based route matching can drift
// out of sync with how Next.js actually routes requests.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
