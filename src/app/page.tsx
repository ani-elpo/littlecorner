import { requireAllowedUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Board } from "@/components/board";
import type { Post } from "@/lib/types";

export default async function BoardPage() {
  const { userId, name } = await requireAllowedUser();

  const supabase = createServiceRoleClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to load posts: ${error.message}`);

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Board
          initialPosts={(posts ?? []) as Post[]}
          currentUserId={userId}
          currentUserName={name}
        />
      </main>
    </>
  );
}
