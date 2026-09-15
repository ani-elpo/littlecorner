"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Reply } from "@/lib/types";

export function ReplyThread({ postId, authorName }: { postId: string; authorName: string }) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { getToken } = useAuth();
  const knownIds = useRef(new Set<string>());

  const addReply = useCallback((reply: Reply) => {
    if (knownIds.current.has(reply.id)) return;
    knownIds.current.add(reply.id);
    setReplies((prev) => [...prev, reply]);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/replies`);
      if (!res.ok) return;
      const { replies: fetched } = (await res.json()) as { replies: Reply[] };
      knownIds.current = new Set(fetched.map((r) => r.id));
      setReplies(fetched);
      setLoaded(true);
    } catch {
      // best-effort; leave the thread empty and let the user retry by reopening
    }
  }, [postId]);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      await load();
    })();
  }, [open, loaded, load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(() => getToken());
    const channel = supabase
      .channel(`replies-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "replies", filter: `post_id=eq.${postId}` },
        (payload) => addReply(payload.new as Reply)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, getToken, addReply]);

  async function handleSubmit() {
    const content = text.trim();
    if (!content || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send that reply.");
      addReply(data.reply as Reply);
      setText("");
      setOpen(true);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send that reply.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-ink/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-display text-xs text-ink/50 hover:text-ink/80 transition-colors"
      >
        &#128172;{" "}
        {replies.length > 0
          ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`
          : "reply"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2.5">
          {replies.map((reply) => (
            <div key={reply.id} className="pl-3 border-l-2 border-ink/10">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xs text-ink/70">{reply.author}</span>
                <span className="font-mono text-[10px] text-ink/40">
                  {format(new Date(reply.created_at), "MMM d, h:mma").toLowerCase()}
                </span>
              </div>
              <p className="font-body text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {reply.content}
              </p>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`reply as ${authorName}...`}
              className="flex-1 bg-transparent font-body text-sm text-ink placeholder:text-ink/35 focus:outline-none border-b border-dashed border-ink/20 pb-1"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSending || !text.trim()}
              className="font-display text-xs px-3 py-1.5 rounded-sm bg-ink text-paper hover:bg-ink/85 disabled:opacity-50 transition-colors"
            >
              {isSending ? "..." : "send"}
            </button>
          </div>
          {error && <p className="text-xs text-red-700 font-body">{error}</p>}
        </div>
      )}
    </div>
  );
}
