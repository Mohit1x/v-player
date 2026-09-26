"use client";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EpisodeInput from "../components/EpisodeInput";
import VideoPlayer from "../components/VideoPlayer";

export default function WatchClient() {
  const router = useRouter();
  const params = useSearchParams();
  const rawUrl = params.get("url");
  const videoUrl = rawUrl ? decodeURIComponent(rawUrl) : null;

  const handleStart = useCallback((url: string) => {
    router.replace(`/watch?url=${encodeURIComponent(url)}`, { scroll: false });
  }, [router]);

  const handleChangeLink = useCallback(() => {
    router.replace("/watch", { scroll: false });
  }, [router]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen">
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <button
          onClick={handleChangeLink}
          className="text-white font-semibold text-sm tracking-tight hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded"
        >
          v-player
        </button>
        {videoUrl && (
          <button
            onClick={handleChangeLink}
            className="text-white/50 text-xs hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded px-2 py-1"
          >
            Change link
          </button>
        )}
      </header>

      {videoUrl ? (
        <main className="flex flex-1 flex-col items-center justify-start px-4 py-6 sm:py-10">
          <div className="w-full max-w-5xl">
            <VideoPlayer url={videoUrl} onChangeLink={handleChangeLink} />
          </div>
        </main>
      ) : (
        <EpisodeInput onStart={handleStart} />
      )}
    </div>
  );
}
