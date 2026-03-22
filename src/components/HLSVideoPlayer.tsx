"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";

interface HLSVideoPlayerProps {
  playerId: string;
  src: string;
  autoPlay?: boolean;
  className?: string;
}

export default function HLSVideoPlayer({
  playerId,
  src,
  autoPlay = true,
  className = "",
}: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMuted, setUserMuted] = useState(false);
  const hasSetActiveRef = useRef(false);

  const { activePlayerId, isPlayerActive, setActivePlayer, isAudioEnabled } = useAudioPlayer();
  const isActive = isPlayerActive(playerId);

  useEffect(() => {
    if (hasSetActiveRef.current) return;
    
    if (activePlayerId === null) {
      setActivePlayer(playerId);
      hasSetActiveRef.current = true;
    }
  }, [playerId, activePlayerId, setActivePlayer]);

  useEffect(() => {
    return () => {
      if (hasSetActiveRef.current && isPlayerActive(playerId)) {
        setActivePlayer(null);
        hasSetActiveRef.current = false;
      }
    };
  }, [playerId, isPlayerActive, setActivePlayer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initHls = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;

          video.addEventListener("loadedmetadata", () => {
            setIsLoading(false);
            if (autoPlay && isActive) {
              video.play().catch(() => {});
            }
          });

          video.addEventListener("error", () => {
            setError("Failed to load video");
            setIsLoading(false);
          });
        } else {
          const Hls = (await import("hls.js")).default;

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setIsLoading(false);
              if (autoPlay && isActive) {
                video.play().catch(() => {});
              }
            });

            hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                setError("Failed to load video stream");
                setIsLoading(false);
              }
            });
          } else {
            setError("HLS not supported in this browser");
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error("HLS initialization error:", err);
        setError("Failed to initialize video");
        setIsLoading(false);
      }
    };

    initHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldBeMuted = !isActive || userMuted || !isAudioEnabled;
    video.muted = shouldBeMuted;

    if (!shouldBeMuted && video.paused && autoPlay) {
      video.play().catch(() => {});
    }
  }, [isActive, userMuted, autoPlay, isAudioEnabled]);

  const toggleMute = () => {
    setUserMuted((prev) => !prev);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white/50 p-4">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const shouldBeMuted = !isActive || userMuted;

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-white/50" />
        </div>
      )}
      <video
        ref={videoRef}
        muted={shouldBeMuted}
        playsInline
        autoPlay={autoPlay && isActive}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
        aria-label={shouldBeMuted ? "Unmute" : "Mute"}
      >
        {shouldBeMuted ? (
          <VolumeX className="w-4 h-4 text-white/70" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
}
