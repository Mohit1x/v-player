"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { PatreonCreator, PatreonPost } from "@/app/lib/patreon/types";
import { decryptResponse } from "@/app/lib/clientCrypto";
import VideoPlayer from "@/app/components/VideoPlayer";

type CreatorState = { status: "loading" } | { status: "done"; data: PatreonCreator | null } | { status: "error" };
type PostsState =
  | { status: "loading" }
  | { status: "done"; posts: PatreonPost[]; nextCursor: string | null }
  | { status: "error"; message: string };

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

export default function CreatorPage() {
  const { userId } = useParams<{ userId: string }>();

  const [creator, setCreator] = useState<CreatorState>({ status: "loading" });
  const [postsState, setPostsState] = useState<PostsState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const patreonUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onPop = () => {
      setPlayingPostId(null);
      setStreamUrl(null);
      setStreamError(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    fetch(`/api/media/${userId}/info`)
      .then(r => r.json())
      .then(j => j.d ? decryptResponse<{ creator: PatreonCreator | null }>(j.d) : { creator: null })
      .then(data => {
        if (data.creator?.patreonUserId) patreonUserIdRef.current = data.creator.patreonUserId;
        setCreator({ status: "done", data: data.creator });
      })
      .catch(() => setCreator({ status: "error" }));

    fetch(`/api/media/${userId}/posts`)
      .then(r => r.json())
      .then(j => {
        if (j.e) return setPostsState({ status: "error", message: "Failed to load posts." });
        return decryptResponse<{ posts: PatreonPost[]; nextCursor: string | null }>(j.d)
          .then(data => setPostsState({ status: "done", posts: data.posts ?? [], nextCursor: data.nextCursor ?? null }));
      })
      .catch(() => setPostsState({ status: "error", message: "Failed to load posts." }));
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (postsState.status !== "done" || !postsState.nextCursor) return;
    setLoadingMore(true);
    try {
      const j = await fetch(`/api/media/${userId}/posts?cursor=${encodeURIComponent(postsState.nextCursor)}`).then(r => r.json());
      if (j.e) return;
      const data = await decryptResponse<{ posts: PatreonPost[]; nextCursor: string | null }>(j.d);
      setPostsState(prev =>
        prev.status === "done"
          ? { status: "done", posts: [...prev.posts, ...(data.posts ?? [])], nextCursor: data.nextCursor ?? null }
          : prev
      );
    } finally {
      setLoadingMore(false);
    }
  }, [postsState, userId]);

  const handlePostClick = useCallback(async (post: PatreonPost) => {
    // If already playing this post, close it
    if (playingPostId === post.id) {
      setPlayingPostId(null);
      setStreamUrl(null);
      setStreamError(null);
      return;
    }
    setPlayingPostId(post.id);
    setStreamUrl(null);
    setStreamError(null);
    try {
      const puid = patreonUserIdRef.current;
      const qs = puid ? `?u=${encodeURIComponent(puid)}` : "";
      const j = await fetch(`/api/stream-post/${userId}/${post.id}${qs}`).then(r => r.json());
      if (j.e) {
        setStreamError("No video available for this post.");
        setPlayingPostId(null);
        return;
      }
      const data = await decryptResponse<{ streamUrl: string }>(j.d);
      if (data.streamUrl) {
        setStreamUrl(data.streamUrl);
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.history.pushState({ playing: post.id }, "");
      } else {
        setStreamError("No video available for this post.");
        setPlayingPostId(null);
      }
    } catch {
      setStreamError("Failed to load video.");
      setPlayingPostId(null);
    }
  }, [userId, playingPostId]);

  const handleClosePlayer = useCallback(() => {
    setPlayingPostId(null);
    setStreamUrl(null);
    setStreamError(null);
  }, []);

  const creatorData = creator.status === "done" ? creator.data : null;
  const posts = postsState.status === "done" ? postsState.posts : [];
  const nextCursor = postsState.status === "done" ? postsState.nextCursor : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm mb-8 inline-block transition-colors">
          ← Back to search
        </Link>

        {/* Creator header */}
        <div className="flex items-center gap-5 mb-10 mt-4">
          {creator.status === "loading" ? (
            <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse shrink-0" />
          ) : creatorData?.avatar ? (
            <Image src={creatorData.avatar} alt={creatorData.name} width={64} height={64}
              className="w-16 h-16 rounded-full object-cover shrink-0" unoptimized />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-2xl font-semibold shrink-0">
              {creatorData?.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            {creator.status === "loading" ? (
              <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
            ) : (
              <h1 className="text-xl font-semibold">{creatorData?.name ?? userId}</h1>
            )}
          </div>
        </div>

        {/* Inline video player */}
        {streamUrl && playingPostId && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-300 truncate pr-4">
                {posts.find(p => p.id === playingPostId)?.title ?? ""}
              </p>
              <button
                type="button"
                onClick={handleClosePlayer}
                className="text-zinc-500 hover:text-zinc-300 text-xs shrink-0 transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <VideoPlayer url={streamUrl} onChangeLink={handleClosePlayer} />
          </div>
        )}

        {/* Stream error toast */}
        {streamError && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">
            {streamError}
          </p>
        )}

        <h2 className="text-lg font-semibold mb-5">Posts</h2>

        {postsState.status === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-pulse">
                <div className="w-full aspect-video bg-zinc-800" />
                <div className="p-4 space-y-2">
                  <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {postsState.status === "error" && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            {postsState.message}
          </p>
        )}

        {postsState.status === "done" && posts.length === 0 && (
          <p className="text-zinc-500 text-sm">No posts found for this creator.</p>
        )}

        {posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post) => {
                const isActive = playingPostId === post.id;
                const isLoadingThis = isActive && !streamUrl && !streamError;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handlePostClick(post)}
                    className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col text-left group transition-colors cursor-pointer ${
                      isActive ? "border-zinc-500" : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="relative w-full aspect-video bg-zinc-800">
                      {post.thumbnail ? (
                        <Image src={post.thumbnail} alt={post.title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">No thumbnail</div>
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                        isLoadingThis ? "opacity-100 bg-black/60" : "opacity-0 group-hover:opacity-100 bg-black/40"
                      }`}>
                        {isLoadingThis ? (
                          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <p className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                        {post.title}
                      </p>
                      <div className="flex items-center gap-2 mt-auto pt-2">
                        {post.publishedAt && (
                          <span className="text-xs text-zinc-500">{formatDate(post.publishedAt)}</span>
                        )}
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                          post.isPaid
                            ? "bg-amber-950/60 text-amber-400 border border-amber-900"
                            : "bg-emerald-950/60 text-emerald-400 border border-emerald-900"
                        }`}>
                          {post.isPaid ? "Paid" : "Public"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {nextCursor && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-200 px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore && <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />}
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
