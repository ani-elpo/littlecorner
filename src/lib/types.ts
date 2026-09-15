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

export type Reply = {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
};

export const REACTION_TYPES = ["❤️", "😂", "😮", "😢", "🔥", "👍"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export type Reaction = {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
};

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  mine: ReactionType[];
};
