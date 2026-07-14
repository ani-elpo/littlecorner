import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function Header() {
  return (
    <header className="w-full border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="font-display text-lg sm:text-xl text-ink tracking-tight">
          our little corner
        </h1>
        <nav className="flex items-center gap-4">
          <Link
            href="/manage"
            className="font-body text-sm text-ink/50 hover:text-ink/80 transition-colors"
          >
            manage
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
