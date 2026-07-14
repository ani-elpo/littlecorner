"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Post } from "@/lib/types";
import { Composer } from "@/components/composer";
import { PostCard } from "@/components/post-card";

export function Board({
  initialPosts,
  currentUserName,
}: {
  initialPosts: Post[];
  currentUserId: string;
  currentUserName: string;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const { getToken } = useAuth();
  const knownIds = useRef(new Set(initialPosts.map((p) => p.id)));

  const addPost = useCallback((post: Post) => {
    if (knownIds.current.has(post.id)) return;
    knownIds.current.add(post.id);
    setPosts((prev) => [post, ...prev]);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(() => getToken());
    const channel = supabase
      .channel("posts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => addPost(payload.new as Post)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addPost, getToken]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24">
      <Composer authorName={currentUserName} onPosted={addPost} />
      <div className="flex flex-col gap-6 mt-10">
        {posts.length === 0 && (
          <p className="text-center font-body italic text-ink/50 py-16">
            nothing pinned up yet — say something &#9825;
          </p>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
