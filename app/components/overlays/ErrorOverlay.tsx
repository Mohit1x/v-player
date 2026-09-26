import { AlertCircle } from "lucide-react";

interface Props {
  onRetry: () => void;
  onChangeLink: () => void;
  message?: string;
}

export default function ErrorOverlay({ onRetry, onChangeLink, message }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-4 px-6 text-center">
      <AlertCircle className="text-red-400 w-10 h-10" />
      <div>
        <p className="text-white font-semibold text-lg">Couldn&apos;t load this episode</p>
        <p className="text-white/60 text-sm mt-1">
          {message ?? "The video link may be invalid, expired, or unavailable."}
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Try Again
        </button>
        <button
          onClick={onChangeLink}
          className="px-5 py-2 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Change Link
        </button>
      </div>
    </div>
  );
}
