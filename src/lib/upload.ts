"use client";

import { createUploadTargets } from "@/lib/actions";
import { getSupabaseUploadClient } from "@/lib/supabase/browser";
import { MEDIA_BUCKET } from "@/lib/media";

export type FileToUpload = { path: string; file: File | Blob; contentType: string };

/**
 * Uploads files straight from the browser to Supabase Storage using
 * short-lived signed upload URLs, bypassing the Next.js server entirely
 * for the actual bytes (Vercel serverless functions cap request bodies at
 * a few MB, which a folder of photos or a video would blow past).
 */
export async function uploadFilesDirect(files: FileToUpload[]): Promise<void> {
  if (files.length === 0) return;

  const targets = await createUploadTargets(files.map((f) => f.path));
  const tokenByPath = new Map(targets.map((t) => [t.path, t.token]));
  const supabase = getSupabaseUploadClient();

  await Promise.all(
    files.map(async ({ path, file, contentType }) => {
      const token = tokenByPath.get(path);
      if (!token) throw new Error(`No upload token for ${path}`);
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType });
      if (error) throw new Error(`Failed to upload ${path}: ${error.message}`);
    })
  );
}
