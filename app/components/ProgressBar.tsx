"use client";
import { useRef } from "react";

interface Props {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ProgressBar({ currentTime, duration, onSeek }: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  function seekFromEvent(clientX: number) {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const { left, width } = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    onSeek(ratio * duration);
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    seekFromEvent(e.clientX);
    const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    seekFromEvent(e.touches[0].clientX);
    const onMove = (ev: TouchEvent) => seekFromEvent(ev.touches[0].clientX);
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  return (
    <div className="flex items-center gap-3 w-full select-none">
      <span className="text-white/70 text-xs tabular-nums min-w-[36px]">{fmt(currentTime)}</span>
      <div
        ref={barRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
        className="relative flex-1 h-1.5 rounded-full bg-white/20 cursor-pointer group"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 5));
          if (e.key === "ArrowRight") onSeek(Math.min(duration, currentTime + 5));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white transition-none"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
      <span className="text-white/70 text-xs tabular-nums min-w-[36px] text-right">{fmt(duration)}</span>
    </div>
  );
}
