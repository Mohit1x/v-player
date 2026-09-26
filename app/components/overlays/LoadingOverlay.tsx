export default function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
      <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin mb-4" />
      <p className="text-white/80 text-sm font-medium tracking-wide">Loading episode…</p>
    </div>
  );
}
