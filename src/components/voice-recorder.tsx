"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function pickMimeType(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export function VoiceRecorder({
  blob,
  onChange,
}: {
  blob: Blob | null;
  onChange: (blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        onChange(recordedBlob);
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone. Check your browser permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function discard() {
    onChange(null);
  }

  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {!recording && !blob && (
          <button
            type="button"
            onClick={startRecording}
            className="font-display text-xs px-3 py-1.5 rounded-sm border border-ink/25 text-ink/70 hover:bg-ink/5 transition-colors"
          >
            &#127908; record voice note
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="font-display text-xs px-3 py-1.5 rounded-sm border border-red-800/40 text-red-800 bg-red-50 animate-pulse"
          >
            &#9632; stop recording
          </button>
        )}
        {!recording && blob && (
          <>
            <audio controls src={previewUrl ?? undefined} className="h-9" />
            <button
              type="button"
              onClick={discard}
              className="font-body text-xs text-ink/50 hover:text-ink/80 underline"
            >
              discard
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-700 font-body">{error}</p>}
    </div>
  );
}
