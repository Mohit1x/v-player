"use client";
import { useEffect, useRef, useState } from "react";
import { SkipBack, SkipForward } from "lucide-react";

interface Props {
  direction: "backward" | "forward" | null;
  onDone: () => void;
}

export default function SkipAnimation({ direction, onDone }: Props) {
  const [activeDir, setActiveDir] = useState<"backward" | "forward" | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!direction) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActiveDir(direction), 0);
    const hide = setTimeout(() => {
      setActiveDir(null);
      onDone();
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(hide);
    };
  // onDone is intentionally excluded — it's a stable callback from parent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  if (!activeDir) return null;

  const isBack = activeDir === "backward";

  return (
    <div
      className={`absolute inset-y-0 ${isBack ? "left-0" : "right-0"} w-1/2 flex items-center ${isBack ? "justify-start pl-8" : "justify-end pr-8"} pointer-events-none z-30`}
    >
      <div className="flex flex-col items-center gap-1 animate-skip-fade">
        <div className="rounded-full bg-white/20 backdrop-blur-sm p-4">
          {isBack ? (
            <SkipBack className="w-7 h-7 text-white fill-white" />
          ) : (
            <SkipForward className="w-7 h-7 text-white fill-white" />
          )}
        </div>
        <span className="text-white text-xs font-semibold drop-shadow">
          {isBack ? "−10s" : "+10s"}
        </span>
      </div>
    </div>
  );
}
