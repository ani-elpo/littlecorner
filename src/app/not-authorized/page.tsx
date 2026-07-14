import { SignOutButton } from "@clerk/nextjs";

export default function NotAuthorizedPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center gap-4">
      <h1 className="font-display text-2xl text-ink">this corner is private</h1>
      <p className="font-body text-ink/70 max-w-sm">
        This board only has room for two. If you think that&apos;s a mistake,
        ask whoever built it to add your email to the guest list.
      </p>
      <SignOutButton>
        <button className="mt-2 font-display text-sm px-4 py-2 border border-ink/30 rounded-sm hover:bg-ink/5 transition-colors">
          sign out
        </button>
      </SignOutButton>
    </main>
  );
}
