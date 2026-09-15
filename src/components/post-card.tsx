import { format } from "date-fns";
import { publicMediaUrl } from "@/lib/media";
import { ReactionsBar } from "@/components/reactions-bar";
import { ReplyThread } from "@/components/reply-thread";
import type { Post } from "@/lib/types";

function Timestamp({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <time dateTime={iso} className="font-mono text-xs text-ink/50 tracking-wide">
      {format(date, "MMM d, yyyy")} &middot; {format(date, "h:mma").toLowerCase()}
    </time>
  );
}

function MediaGrid({ media }: { media: Post["media"] }) {
  if (media.length === 0) return null;
  return (
    <div
      className={`grid gap-2 mt-3 ${
        media.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
      }`}
    >
      {media.map((item, i) =>
        item.kind === "video" ? (
          <video
            key={i}
            src={publicMediaUrl(item.path)}
            controls
            className="rounded-sm border border-ink/10 w-full max-h-80 object-cover bg-black/5"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={publicMediaUrl(item.path)}
            alt=""
            className="rounded-sm border border-ink/10 w-full max-h-80 object-cover"
          />
        )
      )}
    </div>
  );
}

const TILTS = ["-rotate-[0.6deg]", "rotate-[0.5deg]", "-rotate-[0.3deg]", "rotate-[0.8deg]", "rotate-0"];

function tiltFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TILTS[Math.abs(hash) % TILTS.length];
}

export function PostCard({
  post,
  currentUserName,
}: {
  post: Post;
  currentUserName: string;
}) {
  if (post.type === "daily_photo") {
    const photo = post.media[0];
    return (
      <article className="polaroid mx-auto w-full max-w-sm rotate-[-1.5deg]">
        <span className="font-display text-xs tracking-wide text-ink/70">
          today&apos;s photo &#128247;
        </span>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicMediaUrl(photo.path)}
            alt="today's photo"
            className="mt-2 w-full aspect-square object-cover border border-ink/10"
          />
        )}
        <div className="mt-2 flex justify-end">
          <Timestamp iso={post.created_at} />
        </div>
        <ReactionsBar postId={post.id} />
        <ReplyThread postId={post.id} authorName={currentUserName} />
      </article>
    );
  }

  return (
    <article className={`note-card ${tiltFor(post.id)}`}>
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-display text-sm text-ink/80">{post.author_name}</span>
        <Timestamp iso={post.created_at} />
      </header>

      {post.body && (
        <p className="font-body text-ink whitespace-pre-wrap leading-relaxed">
          {post.body}
        </p>
      )}

      {post.drawing_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publicMediaUrl(post.drawing_path)}
          alt="a little drawing"
          className="mt-3 rounded-sm border border-ink/10 bg-white max-h-96 mx-auto"
        />
      )}

      <MediaGrid media={post.media} />

      {post.voice_path && (
        <audio
          controls
          src={publicMediaUrl(post.voice_path)}
          className="mt-3 w-full"
        />
      )}

      <ReactionsBar postId={post.id} />
      <ReplyThread postId={post.id} authorName={currentUserName} />
    </article>
  );
}
