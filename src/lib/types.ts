import type { MediaItem } from "@/lib/media";

export type PostType = "post" | "daily_photo";

export type Post = {
  id: string;
  author_id: string;
  author_name: string;
  type: PostType;
  body: string | null;
  drawing_path: string | null;
  media: MediaItem[];
  voice_path: string | null;
  created_at: string;
};
