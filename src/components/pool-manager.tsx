"use client";

import { useRef, useState, useTransition } from "react";
import { registerPoolPhotos } from "@/lib/actions";
import { uploadFilesDirect, type FileToUpload } from "@/lib/upload";
import { safeFileName } from "@/lib/media";

/**
 * Plain <input type="file" webkitdirectory> so a whole folder can be
 * selected at once. webkitdirectory isn't in React's DOM typings, so this
 * is a thin custom element wrapper instead of casting props inline.
 */
function FolderInput({
  inputRef,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      onChange={(e) => onFiles(e.target.files)}
      className="hidden"
      {...{ webkitdirectory: "", directory: "" }}
    />
  );
}

export function PoolManager({ total, unused }: { total: number; unused: number }) {
  const [stats, setStats] = useState({ total, unused });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("No image files found in that selection.");
      return;
    }

    setError(null);
    setStatus(`uploading ${files.length} photo${files.length > 1 ? "s" : ""}...`);

    startTransition(async () => {
      try {
        const uploads: FileToUpload[] = files.map((file) => ({
          path: `pool/${crypto.randomUUID()}-${safeFileName(file.name)}`,
          file,
          contentType: file.type,
        }));

        await uploadFilesDirect(uploads);
        const { added } = await registerPoolPhotos(uploads.map((u) => u.path));

        setStats((prev) => ({ total: prev.total + added, unused: prev.unused + added }));
        setStatus(`added ${added} photo${added === 1 ? "" : "s"} to the pool.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong uploading those.");
        setStatus(null);
      }
    });

    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  return (
    <div className="note-card">
      <div className="flex gap-6 mb-6 font-body text-sm text-ink/70">
        <div>
          <span className="font-display text-2xl text-ink block">{stats.total}</span>
          photos in pool
        </div>
        <div>
          <span className="font-display text-2xl text-ink block">{stats.unused}</span>
          not shown yet
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => filesInputRef.current?.click()}
          className="font-display text-xs px-3 py-1.5 rounded-sm border border-ink/25 text-ink/70 hover:bg-ink/5 transition-colors disabled:opacity-50"
        >
          choose photos
        </button>
        <input
          ref={filesInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <button
          type="button"
          disabled={isPending}
          onClick={() => folderInputRef.current?.click()}
          className="font-display text-xs px-3 py-1.5 rounded-sm border border-ink/25 text-ink/70 hover:bg-ink/5 transition-colors disabled:opacity-50"
        >
          choose a whole folder
        </button>
        <FolderInput inputRef={folderInputRef} onFiles={handleFiles} />
      </div>

      {status && <p className="font-body text-sm text-ink/60 mt-3">{status}</p>}
      {error && <p className="font-body text-sm text-red-700 mt-3">{error}</p>}
    </div>
  );
}
