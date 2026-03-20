"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

interface HLSPlayerProps {
  src: string;
  onStreamReady?: (stream: MediaStream) => void;
  muted?: boolean;
  autoPlay?: boolean;
  className?: string;
}

export default function HLSPlayer({ 
  src, 
  onStreamReady, 
  muted = true, 
  autoPlay = true,
  className = "" 
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    setIsMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initHls = async () => {
      try {
        // Check if HLS is natively supported
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS support (Safari)
          video.src = src;
          video.addEventListener("loadedmetadata", () => {
            setIsLoading(false);
            if (autoPlay) {
              video.play().catch(console.error);
            }
          });
          video.addEventListener("error", () => {
            setError("Failed to load video");
            setIsLoading(false);
          });
        } else {
          // Use hls.js for other browsers
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
              if (autoPlay) {
                video.play().catch(console.error);
              }
            });

            hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                console.error("HLS Error:", data);
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
      }
    };
  }, [src, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onStreamReady) return;

    const captureStream = () => {
      if (video.srcObject) return;
      
      try {
        const stream = (video as HTMLVideoElement & { captureStream: (fps: number) => MediaStream }).captureStream(15);
        onStreamReady(stream);
      } catch (err) {
        console.error("Failed to capture stream:", err);
      }
    };

    video.addEventListener("playing", captureStream);
    
    return () => {
      video.removeEventListener("playing", captureStream);
    };
  }, [onStreamReady]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white/50">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-white/50" />
        </div>
      )}
      <video
        ref={videoRef}
        muted={isMuted}
        playsInline
        autoPlay={autoPlay}
        className="w-full h-full object-contain"
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-white/70" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
}
