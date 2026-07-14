export const MEDIA_BUCKET = "board-media";

export type MediaItem = {
  path: string;
  mime: string;
  kind: "image" | "video";
};

/**
 * Builds a public URL for a file stored in the board-media bucket.
 * The bucket is public but paths are random UUIDs, so this is "unlisted
 * link" security - see the README for the private/signed-URL alternative.
 */
export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export function publicMediaUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
