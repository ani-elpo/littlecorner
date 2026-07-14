"use client";

import { useRef, useState, useTransition } from "react";
import { createPost } from "@/lib/actions";
import { uploadFilesDirect, type FileToUpload } from "@/lib/upload";
import { safeFileName, type MediaItem } from "@/lib/media";
import { DrawingCanvas, type DrawingCanvasHandle } from "@/components/drawing-canvas";
import { VoiceRecorder } from "@/components/voice-recorder";
import type { Post } from "@/lib/types";

type MediaFile = { file: File; url: string; kind: "image" | "video" };

export function Composer({
  authorName,
  onPosted,
}: {
  authorName: string;
  onPosted: (post: Post) => void;
}) {
  const [body, setBody] = useState("");
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const drawingRef = useRef<DrawingCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const next: MediaFile[] = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") ? "video" : "image",
    }));
    setMediaFiles((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeMedia(index: number) {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetComposer() {
    setBody("");
    mediaFiles.forEach((m) => URL.revokeObjectURL(m.url));
    setMediaFiles([]);
    setVoiceBlob(null);
    setDrawingOpen(false);
    drawingRef.current?.clear();
  }

  async function handleSubmit() {
    setError(null);
    const drawingBlob = await drawingRef.current?.getBlob();

    if (!body.trim() && !drawingBlob && !voiceBlob && mediaFiles.length === 0) {
      setError("Write something, draw something, or attach something first.");
      return;
    }

    startTransition(async () => {
      try {
        const postId = crypto.randomUUID();
        const folder = `posts/${postId}`;
        const uploads: FileToUpload[] = [];

        let drawingPath: string | null = null;
        if (drawingBlob) {
          drawingPath = `${folder}/drawing.png`;
          uploads.push({ path: drawingPath, file: drawingBlob, contentType: "image/png" });
        }

        let voicePath: string | null = null;
        if (voiceBlob) {
          const ext = voiceBlob.type.includes("mp4") ? "m4a" : "webm";
          voicePath = `${folder}/voice.${ext}`;
          uploads.push({
            path: voicePath,
            file: voiceBlob,
            contentType: voiceBlob.type || "audio/webm",
          });
        }

        const media: MediaItem[] = mediaFiles.map((m, i) => {
          const kind: MediaItem["kind"] = m.kind;
          const path = `${folder}/media/${i}-${safeFileName(m.file.name)}`;
          uploads.push({
            path,
            file: m.file,
            contentType: m.file.type || "application/octet-stream",
          });
          return { path, mime: m.file.type || "application/octet-stream", kind };
        });

        await uploadFilesDirect(uploads);

        const { post } = await createPost({
          body: body.trim() || null,
          drawingPath,
          voicePath,
          media,
        });
        onPosted(post);
        resetComposer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong posting that.");
      }
    });
  }

  return (
    <section className="note-card">
      <p className="font-display text-xs text-ink/50 mb-2">
        posting as {authorName}
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="what's on your mind..."
        rows={3}
        className="w-full resize-y bg-transparent font-body text-ink placeholder:text-ink/35 focus:outline-none border-b border-dashed border-ink/20 pb-3"
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => setDrawingOpen((v) => !v)}
          className="font-display text-xs px-3 py-1.5 rounded-sm border border-ink/25 text-ink/70 hover:bg-ink/5 transition-colors"
        >
          &#9998; {drawingOpen ? "hide drawing" : "add a drawing"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="font-display text-xs px-3 py-1.5 rounded-sm border border-ink/25 text-ink/70 hover:bg-ink/5 transition-colors"
        >
          &#128247; photos / videos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <VoiceRecorder blob={voiceBlob} onChange={setVoiceBlob} />
      </div>

      <div className={drawingOpen ? "mt-3 block" : "hidden"}>
        <DrawingCanvas ref={drawingRef} />
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {mediaFiles.map((m, i) => (
            <div key={m.url} className="relative group">
              {m.kind === "video" ? (
                <video src={m.url} className="w-full h-20 object-cover rounded-sm border border-ink/15" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="w-full h-20 object-cover rounded-sm border border-ink/15" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-paper text-xs leading-5 text-center opacity-80 hover:opacity-100"
                aria-label="remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-700 font-body mt-2">{error}</p>}

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="font-display text-sm px-5 py-2 rounded-sm bg-ink text-paper hover:bg-ink/85 disabled:opacity-50 transition-colors"
        >
          {isPending ? "pinning it up..." : "post"}
        </button>
      </div>
    </section>
  );
}
