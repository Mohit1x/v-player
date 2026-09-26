"use client";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  PictureInPicture2, SkipBack, SkipForward,
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import PlaybackSpeedMenu from "./menus/PlaybackSpeedMenu";
import QualityMenu, { Quality } from "./menus/QualityMenu";

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  pipSupported: boolean;
  qualities: Quality[];
  selectedQuality: number;
  speedMenuOpen: boolean;
  qualityMenuOpen: boolean;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
  onPip: () => void;
  onSkip: (delta: number) => void;
  onSpeedToggle: () => void;
  onSpeedSelect: (s: number) => void;
  onQualityToggle: () => void;
  onQualitySelect: (l: number) => void;
}

export default function VideoControls({
  isPlaying, currentTime, duration, volume, isMuted, playbackRate,
  isFullscreen, pipSupported, qualities, selectedQuality,
  speedMenuOpen, qualityMenuOpen,
  onPlayPause, onSeek, onVolumeChange, onMuteToggle, onFullscreen,
  onPip, onSkip, onSpeedToggle, onSpeedSelect, onQualityToggle, onQualitySelect,
}: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
      {/* Progress */}
      <ProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} />

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2 gap-1">
        {/* Left group */}
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={() => onSkip(-10)} label="Skip back 10s">
            <SkipBack className="w-5 h-5" />
          </IconBtn>
          <IconBtn onClick={onPlayPause} label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </IconBtn>
          <IconBtn onClick={() => onSkip(10)} label="Skip forward 10s">
            <SkipForward className="w-5 h-5" />
          </IconBtn>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <IconBtn onClick={onMuteToggle} label={isMuted ? "Unmute" : "Mute"}>
              {isMuted || volume === 0
                ? <VolumeX className="w-5 h-5" />
                : <Volume2 className="w-5 h-5" />}
            </IconBtn>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume"
              className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-white cursor-pointer hidden sm:block"
            />
          </div>
        </div>

        {/* Right group */}
        <div className="flex items-center gap-0.5">
          <PlaybackSpeedMenu
            speed={playbackRate}
            open={speedMenuOpen}
            onToggle={onSpeedToggle}
            onSelect={onSpeedSelect}
          />
          <QualityMenu
            qualities={qualities}
            selected={selectedQuality}
            open={qualityMenuOpen}
            onToggle={onQualityToggle}
            onSelect={onQualitySelect}
          />
          {pipSupported && (
            <IconBtn onClick={onPip} label="Picture in picture">
              <PictureInPicture2 className="w-5 h-5" />
            </IconBtn>
          )}
          <IconBtn onClick={onFullscreen} label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="text-white/90 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      {children}
    </button>
  );
}
