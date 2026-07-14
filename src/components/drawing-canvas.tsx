"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type DrawingCanvasHandle = {
  getBlob: () => Promise<Blob | null>;
  clear: () => void;
};

const COLORS = ["#2b2b2b", "#a6472e", "#2f5d50", "#2e4a7d", "#c98a2c", "#ffffff"];
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 360;

export const DrawingCanvas = forwardRef<DrawingCanvasHandle>(function DrawingCanvas(
  _props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);

  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);
  const [erasing, setErasing] = useState(false);

  useImperativeHandle(ref, () => ({
    getBlob: () =>
      new Promise((resolve) => {
        if (!hasDrawn.current || !canvasRef.current) {
          resolve(null);
          return;
        }
        canvasRef.current.toBlob((blob) => resolve(blob), "image/png");
      }),
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn.current = false;
    },
  }));

  function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointFromEvent(e);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPoint.current) return;

    const point = pointFromEvent(e);
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = erasing ? brushSize * 3 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPoint.current = point;
    hasDrawn.current = true;
  }

  function handlePointerUp() {
    drawing.current = false;
    lastPoint.current = null;
  }

  return (
    <div className="border border-ink/15 rounded-sm bg-white p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full touch-none rounded-sm cursor-crosshair"
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      />
      <div className="flex flex-wrap items-center gap-3 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`color ${c}`}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={`w-5 h-5 rounded-full border ${
                color === c && !erasing ? "ring-2 ring-offset-1 ring-ink/60" : "border-ink/20"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setErasing(false);
            }}
            className="w-6 h-6 rounded-full border border-ink/20 cursor-pointer bg-transparent"
            title="custom color"
          />
        </div>

        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20 accent-ink"
          title="brush size"
        />

        <button
          type="button"
          onClick={() => setErasing((v) => !v)}
          className={`font-body text-xs px-2 py-1 rounded-sm border ${
            erasing ? "bg-ink text-paper border-ink" : "border-ink/25 text-ink/70"
          }`}
        >
          eraser
        </button>

        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn.current = false;
          }}
          className="font-body text-xs px-2 py-1 rounded-sm border border-ink/25 text-ink/70 ml-auto"
        >
          clear
        </button>
      </div>
    </div>
  );
});
