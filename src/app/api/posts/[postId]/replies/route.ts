import { NextResponse } from "next/server";
import { getAllowedUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Reply } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAllowedUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { postId } = await params;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: (data ?? []) as Reply[] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAllowedUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "A reply needs some text." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("replies")
    .insert({ post_id: postId, author: user.name, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reply: data as Reply }, { status: 201 });
}
