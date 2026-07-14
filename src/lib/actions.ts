"use server";

import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type MediaItem } from "@/lib/media";
import type { Post } from "@/lib/types";

export type UploadTarget = { path: string; token: string };

/**
 * Mints signed upload URLs for the given storage paths so the browser can
 * upload file bytes directly to Supabase Storage - never through a Next.js
 * server action/route, which on Vercel is capped at a few MB per request.
 */
export async function createUploadTargets(paths: string[]): Promise<UploadTarget[]> {
  await requireAllowedUser();
  if (paths.length === 0) return [];

  const supabase = createServiceRoleClient();
  const targets: UploadTarget[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(`Failed to prepare upload for ${path}: ${error.message}`);
    targets.push({ path, token: data.token });
  }
  return targets;
}

export type CreatePostInput = {
  body: string | null;
  drawingPath: string | null;
  voicePath: string | null;
  media: MediaItem[];
};

/**
 * Creates a combined post: text, an optional drawing, optional photos/videos,
 * and an optional voice note - all as one board entry. File bytes are
 * already sitting in storage by the time this runs (see createUploadTargets);
 * this just writes the row.
 */
export async function createPost(input: CreatePostInput): Promise<{ post: Post }> {
  const { userId, name } = await requireAllowedUser();

  if (!input.body && !input.drawingPath && !input.voicePath && input.media.length === 0) {
    throw new Error("A post needs at least some text, a drawing, media, or a voice note.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      author_name: name,
      type: "post",
      body: input.body,
      drawing_path: input.drawingPath,
      voice_path: input.voicePath,
      media: input.media,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save post: ${error.message}`);

  revalidatePath("/");
  return { post: data as Post };
}

/**
 * Records photos already uploaded (via createUploadTargets) into the daily
 * photo pool.
 */
export async function registerPoolPhotos(paths: string[]): Promise<{ added: number }> {
  const { userId } = await requireAllowedUser();
  if (paths.length === 0) return { added: 0 };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("photo_pool")
    .insert(paths.map((path) => ({ file_path: path, uploaded_by: userId })));

  if (error) throw new Error(`Failed to add photos to the pool: ${error.message}`);

  revalidatePath("/manage");
  return { added: paths.length };
}
