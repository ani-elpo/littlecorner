import { NextResponse } from "next/server";
import { getAllowedUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { REACTION_TYPES, type ReactionSummary, type ReactionType } from "@/lib/types";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function summarize(
  supabase: ServiceClient,
  postId: string,
  userId: string
): Promise<ReactionSummary> {
  const { data, error } = await supabase
    .from("reactions")
    .select("reaction_type, user_id")
    .eq("post_id", postId);

  if (error) throw new Error(error.message);

  const counts = Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<
    ReactionType,
    number
  >;
  const mine: ReactionType[] = [];
  for (const row of data ?? []) {
    const type = row.reaction_type as ReactionType;
    counts[type] += 1;
    if (row.user_id === userId) mine.push(type);
  }
  return { counts, mine };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAllowedUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { postId } = await params;
  const supabase = createServiceRoleClient();
  try {
    return NextResponse.json(await summarize(supabase, postId, user.userId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load reactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Toggles the current user's reaction of the given type on this post: adds
 * it if they haven't reacted with that emoji yet, removes it if they have.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAllowedUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const reactionType = body?.reactionType;
  if (!(REACTION_TYPES as readonly string[]).includes(reactionType)) {
    return NextResponse.json({ error: "Unknown reaction type." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  try {
    const { data: existing, error: selectError } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.userId)
      .eq("reaction_type", reactionType)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    if (existing) {
      const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("reactions")
        .insert({ post_id: postId, user_id: user.userId, reaction_type: reactionType });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json(await summarize(supabase, postId, user.userId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save reaction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
