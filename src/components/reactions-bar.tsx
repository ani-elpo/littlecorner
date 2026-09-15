"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { REACTION_TYPES, type ReactionSummary, type ReactionType } from "@/lib/types";

const EMPTY_SUMMARY: ReactionSummary = {
  counts: Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<ReactionType, number>,
  mine: [],
};

export function ReactionsBar({ postId }: { postId: string }) {
  const [summary, setSummary] = useState<ReactionSummary>(EMPTY_SUMMARY);
  const [pending, setPending] = useState<ReactionType | null>(null);
  const { getToken } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/reactions`);
      if (!res.ok) return;
      setSummary(await res.json());
    } catch {
      // best-effort refresh; keep whatever we last had
    }
  }, [postId]);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(() => getToken());
    const channel = supabase
      .channel(`reactions-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `post_id=eq.${postId}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, getToken, refresh]);

  async function toggle(type: ReactionType) {
    if (pending) return;
    setPending(type);
    try {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: type }),
      });
      if (res.ok) setSummary(await res.json());
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-dashed border-ink/15">
      {REACTION_TYPES.map((type) => {
        const count = summary.counts[type] ?? 0;
        const active = summary.mine.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            disabled={pending !== null}
            aria-pressed={active}
            className={`font-display text-xs px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 disabled:opacity-50 ${
              active
                ? "border-rust/50 bg-rust/10 text-rust"
                : "border-ink/15 text-ink/60 hover:bg-ink/5"
            }`}
          >
            <span>{type}</span>
            {count > 0 && <span className="font-mono tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
