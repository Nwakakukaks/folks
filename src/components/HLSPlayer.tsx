"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

interface HLSPlayerProps {
  src: string;
  onStreamReady?: (stream: MediaStream | null) => void;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const hlsRef = useRef<any>(null);
  const streamReadyCalledRef = useRef(false);
  const drawLoopStartedRef = useRef(false);
  const onStreamReadyRef = useRef(onStreamReady);

  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  }, [onStreamReady]);

  const captureCanvasStream = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!drawLoopStartedRef.current) {
        const updateCanvasSize = () => {
          if (video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
        };

        updateCanvasSize();
        video.addEventListener("loadedmetadata", updateCanvasSize);

        const drawFrame = () => {
          if (video && ctx && canvas) {
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } catch {
              // Ignore draw errors during transition
            }
          }
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };

        drawLoopStartedRef.current = true;
        drawFrame();
      }

      if (!streamReadyCalledRef.current && onStreamReadyRef.current) {
        const stream = canvas.captureStream(15);
        canvasStreamRef.current = stream;
        streamReadyCalledRef.current = true;
        onStreamReadyRef.current(stream);
      }
    } catch (err) {
      console.error("Failed to create canvas stream:", err);
    }
  }, []);

  useEffect(() => {
    if (onStreamReadyRef.current && !streamReadyCalledRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const stream = canvas.captureStream(15);
        canvasStreamRef.current = stream;
        streamReadyCalledRef.current = true;
        onStreamReadyRef.current(stream);
      } catch {
        // no-op
      }
    }
  }, [onStreamReady]);

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
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          
          video.addEventListener("loadedmetadata", () => {
            setIsLoading(false);
            captureCanvasStream();
            if (autoPlay) {
              video.play().catch(console.error);
            }
          });
          
          video.addEventListener("playing", () => {
            captureCanvasStream();
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
              captureCanvasStream();
              if (autoPlay) {
                video.play().catch(console.error);
              }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, () => {
              captureCanvasStream();
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      drawLoopStartedRef.current = false;
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      streamReadyCalledRef.current = false;
    };
  }, [src, autoPlay, captureCanvasStream]);

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

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white/50 p-4">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

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
        className="hidden"
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
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
