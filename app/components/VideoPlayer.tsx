"use client";
import { useEffect, useRef, useCallback, useReducer, useLayoutEffect } from "react";
import Hls, { type Level } from "hls.js";
import { buildProxyUrl } from "@/app/lib/hlsProxy";
import VideoControls from "./VideoControls";
import LoadingOverlay from "./overlays/LoadingOverlay";
import ErrorOverlay from "./overlays/ErrorOverlay";
import SkipAnimation from "./SkipAnimation";
import { Quality } from "./menus/QualityMenu";

interface Props {
  url: string;
  onChangeLink: () => void;
}

interface State {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  selectedQuality: number;
  qualities: Quality[];
  isFullscreen: boolean;
  isLoading: boolean;
  error: boolean;
  errorMessage: string | null;
  controlsVisible: boolean;
  skipDir: "backward" | "forward" | null;
  speedMenuOpen: boolean;
  qualityMenuOpen: boolean;
}

type Action = { type: "SET"; payload: Partial<State> };

function reducer(state: State, action: Action): State {
  return { ...state, ...action.payload };
}

const INIT: State = {
  isPlaying: false, currentTime: 0, duration: 0,
  volume: 1, isMuted: false, playbackRate: 1,
  selectedQuality: -1, qualities: [],
  isFullscreen: false, isLoading: true, error: false, errorMessage: null,
  controlsVisible: true, skipDir: null,
  speedMenuOpen: false, qualityMenuOpen: false,
};

export default function VideoPlayer({ url, onChangeLink }: Props) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const set = useCallback((payload: Partial<State>) => dispatch({ type: "SET", payload }), []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Stable callback ref for rAF loop — updated via useLayoutEffect (not during render)
  const syncFnRef = useRef<() => void>(() => {});

  // ── Keep syncFnRef up to date after every render (layout, before paint) ───
  useLayoutEffect(() => {
    syncFnRef.current = () => {
      const v = videoRef.current;
      if (!v) return;
      set({ currentTime: v.currentTime, duration: v.duration || 0 });
      rafRef.current = requestAnimationFrame(syncFnRef.current);
    };
  });

  // ── HLS setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    set({ isLoading: true, error: false, qualities: [], selectedQuality: -1 });

    function destroyHls() {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    }

    function buildQualities(levels: Level[]): Quality[] {
      const qs: Quality[] = [{ label: "Auto", level: -1 }];
      levels.forEach((l, i) => {
        qs.push({ label: l.height ? `${l.height}p` : `Level ${i + 1}`, level: i });
      });
      return qs;
    }

    // Normalize HTML-encoded ampersands that may appear in pasted URLs
    const normalizedUrl = url.replace(/&amp;/g, "&");
    // Route all traffic through the server-side proxy to avoid CORS
    const proxyUrl = buildProxyUrl(normalizedUrl);
    const isMp4 = !normalizedUrl.includes(".m3u8");

    if (isMp4) {
      // Direct MP4 — skip HLS entirely
      destroyHls();
      video.src = proxyUrl;
      video.addEventListener("loadedmetadata", () => set({ isLoading: false }), { once: true });
      video.addEventListener("error", () => set({ error: true, isLoading: false, errorMessage: null }), { once: true });
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      destroyHls();
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        set({ qualities: buildQualities(data.levels), isLoading: false });
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        // Try to surface a meaningful message from the proxy's JSON error body
        const response = (data.response as { data?: unknown } | undefined);
        let msg: string | null = null;
        if (response?.data && typeof response.data === "object") {
          const d = response.data as Record<string, unknown>;
          if (typeof d.error === "string") msg = d.error;
        }
        set({ error: true, isLoading: false, errorMessage: msg });
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS — still proxy through our server
      video.src = proxyUrl;
      video.addEventListener("loadedmetadata", () => set({ isLoading: false }), { once: true });
      video.addEventListener("error", () => set({ error: true, isLoading: false, errorMessage: null }), { once: true });
      video.play().catch(() => {});
    } else {
      set({ error: true, isLoading: false });
    }

    return () => {
      destroyHls();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [url, set]);

  // ── rAF time sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const start = () => { rafRef.current = requestAnimationFrame(syncFnRef.current); };
    const stop = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
    v.addEventListener("play", start);
    v.addEventListener("pause", stop);
    v.addEventListener("ended", stop);
    return () => {
      v.removeEventListener("play", start);
      v.removeEventListener("pause", stop);
      v.removeEventListener("ended", stop);
      stop();
    };
  }, []);

  // ── Video event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => set({ isPlaying: true });
    const onPause = () => set({ isPlaying: false });
    const onWaiting = () => set({ isLoading: true });
    const onCanPlay = () => set({ isLoading: false });
    const onError = () => set({ error: true, isLoading: false, errorMessage: null });
    const onVolumeChange = () => set({ volume: v.volume, isMuted: v.muted });
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    v.addEventListener("volumechange", onVolumeChange);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      v.removeEventListener("volumechange", onVolumeChange);
    };
  }, [set]);

  // ── Fullscreen change ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement;
      set({ isFullscreen: isFs });
      const orientation = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (!isFs) orientation.unlock?.();
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [set]);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    set({ controlsVisible: true });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => set({ controlsVisible: false }), 3000);
  }, [set]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const playPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, t));
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    set({ skipDir: delta < 0 ? "backward" : "forward" });
  }, [set]);

  const setVolume = useCallback((vol: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = vol;
    v.muted = vol === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const setSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    set({ playbackRate: s });
  }, [set]);

  const setQuality = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    const saved = videoRef.current?.currentTime ?? 0;
    hls.currentLevel = level;
    set({ selectedQuality: level });
    if (videoRef.current) videoRef.current.currentTime = saved;
  }, [set]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // screen.orientation.lock() is a real API but missing from some TS lib versions
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => {
        orientation.lock?.("landscape").catch(() => {});
      }).catch(() => {});
    } else {
      orientation.unlock?.();
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) { document.exitPictureInPicture().catch(() => {}); }
    else { v.requestPictureInPicture().catch(() => {}); }
  }, []);

  const retry = useCallback(() => {
    set({ error: false, isLoading: true, errorMessage: null });
    const v = videoRef.current;
    if (!v) return;
    if (hlsRef.current) { hlsRef.current.stopLoad(); hlsRef.current.startLoad(); }
    else { v.load(); v.play().catch(() => {}); }
  }, [set]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") { e.preventDefault(); playPause(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); skip(-10); }
      else if (e.key === "ArrowRight") { e.preventDefault(); skip(10); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.1)); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setVolume(Math.max(0, (videoRef.current?.volume ?? 1) - 0.1)); }
      else if (e.key === "m" || e.key === "M") { toggleMute(); }
      else if (e.key === "f" || e.key === "F") { toggleFullscreen(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playPause, skip, setVolume, toggleMute, toggleFullscreen]);

  // ── Mobile double-tap ──────────────────────────────────────────────────────
  const handleTap = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Ignore taps that land on an interactive control (button, input, etc.)
    const target = e.target as HTMLElement;
    if (target.closest("button, input, [role='slider']")) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.changedTouches[0].clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
    tapCount.current += 1;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
        showControls();
      }, 250);
    } else if (tapCount.current === 2) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current = 0;
      skip(side === "left" ? -10 : 10);
    }
  }, [skip, showControls]);

  const pipSupported = typeof document !== "undefined" && "pictureInPictureEnabled" in document;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden select-none"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={showControls}
      onMouseLeave={() => { if (state.isPlaying) set({ controlsVisible: false }); }}
      onTouchEnd={handleTap}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
        aria-label="Video player"
      />

      {/* Desktop skip zones */}
      <div className="hidden sm:flex absolute inset-y-0 left-0 w-1/4 items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => skip(-10)}
          aria-label="Skip back 10 seconds"
          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-sm font-bold hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          −10
        </button>
      </div>
      <div className="hidden sm:flex absolute inset-y-0 right-0 w-1/4 items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => skip(10)}
          aria-label="Skip forward 10 seconds"
          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-sm font-bold hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          +10
        </button>
      </div>

      {/* Skip animation */}
      <SkipAnimation direction={state.skipDir} onDone={() => set({ skipDir: null })} />

      {/* Overlays */}
      {state.isLoading && !state.error && <LoadingOverlay />}
      {state.error && <ErrorOverlay onRetry={retry} onChangeLink={onChangeLink} message={state.errorMessage ?? undefined} />}

      {/* Controls */}
      {!state.error && (
        <div className={`transition-opacity duration-300 ${state.controlsVisible || !state.isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <VideoControls
            isPlaying={state.isPlaying}
            currentTime={state.currentTime}
            duration={state.duration}
            volume={state.volume}
            isMuted={state.isMuted}
            playbackRate={state.playbackRate}
            isFullscreen={state.isFullscreen}
            pipSupported={pipSupported}
            qualities={state.qualities}
            selectedQuality={state.selectedQuality}
            speedMenuOpen={state.speedMenuOpen}
            qualityMenuOpen={state.qualityMenuOpen}
            onPlayPause={playPause}
            onSeek={seek}
            onVolumeChange={setVolume}
            onMuteToggle={toggleMute}
            onFullscreen={toggleFullscreen}
            onPip={togglePip}
            onSkip={skip}
            onSpeedToggle={() => set({ speedMenuOpen: !state.speedMenuOpen, qualityMenuOpen: false })}
            onSpeedSelect={setSpeed}
            onQualityToggle={() => set({ qualityMenuOpen: !state.qualityMenuOpen, speedMenuOpen: false })}
            onQualitySelect={setQuality}
          />
        </div>
      )}
    </div>
  );
}
