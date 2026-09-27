"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PatreonCreator } from "@/app/lib/patreon/types";
import { decryptResponse } from "@/app/lib/clientCrypto";

// A few well-known creator IDs to show as suggestions before the user types
const SUGGESTED_IDS = ["3523273", "450353", "103353"];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; creators: PatreonCreator[] };

async function fetchCreatorById(id: string): Promise<PatreonCreator | null> {
  try {
    const res = await fetch(`/api/media/${id}/info`);
    const json = await res.json();
    if (!json.d) return null;
    const data = await decryptResponse<{ creator: PatreonCreator | null }>(json.d);
    return data.creator;
  } catch { return null; }
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [suggestions, setSuggestions] = useState<PatreonCreator[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load suggestions once on mount
  useEffect(() => {
    Promise.all(SUGGESTED_IDS.map(fetchCreatorById))
      .then(results => setSuggestions(results.filter((c): c is PatreonCreator => c !== null)));
  }, []);

  // Search on every keystroke with 400ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setState({ status: "idle" }); return; }
    setState({ status: "loading" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/media/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok || json.e) { setState({ status: "error" }); return; }
        const data = await decryptResponse<{ creators: PatreonCreator[] }>(json.d);
        setState({ status: "done", creators: data.creators ?? [] });
      } catch {
        setState({ status: "error" });
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const showSuggestions = query.trim() === "" && suggestions.length > 0;
  const creators = state.status === "done" ? state.creators : [];

  function CreatorCard({ creator }: { creator: PatreonCreator }) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/creator/${creator.id}`)}
        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center gap-4 transition-colors group text-left w-full cursor-pointer"
      >
        {creator.avatar ? (
          <Image src={creator.avatar} alt={creator.name} width={48} height={48}
            className="w-12 h-12 rounded-full object-cover shrink-0 pointer-events-none" unoptimized />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-zinc-400 text-lg font-semibold pointer-events-none">
            {creator.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 pointer-events-none">
          <p className="font-medium text-sm text-zinc-100 truncate group-hover:text-white">{creator.name}</p>
        </div>
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">Search Creators</h1>
        <p className="text-zinc-400 text-sm mb-8">Find a creator to browse their posts.</p>

        <div className="relative mb-10">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search creators…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {state.status === "loading" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          )}
        </div>

        {state.status === "error" && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">
            Search failed. Please try again.
          </p>
        )}

        {state.status === "done" && creators.length === 0 && (
          <p className="text-zinc-500 text-sm mb-6">No creators found for &ldquo;{query}&rdquo;.</p>
        )}

        {/* Search results */}
        {state.status === "done" && creators.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {creators.map(c => <CreatorCard key={c.id} creator={c} />)}
          </div>
        )}

        {/* Skeleton while searching */}
        {state.status === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions when idle */}
        {showSuggestions && (
          <>
            <p className="text-xs text-zinc-500 mb-4 uppercase tracking-wider">Suggested</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestions.map(c => <CreatorCard key={c.id} creator={c} />)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
