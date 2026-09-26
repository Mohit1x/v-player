"use client";
import { useState } from "react";
import { Play } from "lucide-react";

interface Props {
  initialUrl?: string;
  onStart: (url: string) => void;
}

export default function EpisodeInput({ initialUrl = "", onStart }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Normalize HTML-encoded ampersands that appear in some pasted URLs
    const trimmed = url.trim().replace(/&amp;/g, "&");
    if (!trimmed) {
      setValidationError("Please paste a video link.");
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setValidationError("Please enter a valid URL starting with http:// or https://");
      return;
    }
    if (!trimmed.includes(".m3u8")) {
      setValidationError("Please enter an HLS (.m3u8) video link.");
      return;
    }
    setValidationError("");
    onStart(trimmed);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white text-center tracking-tight mb-2">
          Episode Player
        </h1>
        <p className="text-white/50 text-center text-sm mb-10">
          Paste your episode link below to start watching.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="episode-url" className="text-white/70 text-sm font-medium">
              Episode link
            </label>
            <input
              id="episode-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setValidationError(""); }}
              placeholder="https://example.com/episode.m3u8"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
            />
            {validationError && (
              <p className="text-red-400 text-xs mt-0.5">{validationError}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-white text-black font-semibold py-3.5 text-sm hover:bg-white/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 mt-1"
          >
            Start Episode
          </button>
        </form>

        <p className="text-white/30 text-xs text-center mt-5">
          Supports HLS (.m3u8) video links
        </p>
      </div>
    </div>
  );
}
