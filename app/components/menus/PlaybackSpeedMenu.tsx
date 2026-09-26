"use client";
import { useRef, useEffect } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface Props {
  speed: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (s: number) => void;
}

export default function PlaybackSpeedMenu({ speed, open, onToggle, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        aria-label="Playback speed"
        aria-expanded={open}
        className="flex items-center gap-1 px-2 py-1 rounded text-white/80 text-xs font-semibold hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px] min-w-[44px] justify-center"
      >
        {speed === 1 ? "1×" : `${speed}×`}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[90px]">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => { onSelect(s); onToggle(); }}
              className={`w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:bg-white/10 ${s === speed ? "text-white font-semibold" : "text-white/70"}`}
            >
              {s === 1 ? "1× (Normal)" : `${s}×`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
