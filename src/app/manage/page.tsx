import Link from "next/link";
import { requireAllowedUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PoolManager } from "@/components/pool-manager";

export default async function ManagePage() {
  await requireAllowedUser();
  const supabase = createServiceRoleClient();

  const [{ count: total }, { count: unused }] = await Promise.all([
    supabase.from("photo_pool").select("id", { count: "exact", head: true }),
    supabase
      .from("photo_pool")
      .select("id", { count: "exact", head: true })
      .eq("used", false),
  ]);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="font-body text-sm text-ink/50 hover:text-ink/80 transition-colors"
      >
        &larr; back to the board
      </Link>

      <h1 className="font-display text-2xl text-ink mt-4 mb-1">daily photo pool</h1>
      <p className="font-body text-ink/60 mb-8">
        Drop in a folder of photos and every midnight one gets picked at random
        and pinned to the board as{" "}
        <span className="whitespace-nowrap">&quot;today&apos;s photo&quot;</span>.
        Once every photo has had a turn, the pool cycles back around.
      </p>

      <PoolManager total={total ?? 0} unused={unused ?? 0} />
    </main>
  );
}
