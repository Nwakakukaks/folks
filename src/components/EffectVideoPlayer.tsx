"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface EffectInfo {
  number: number;
  url: string;
  name: string;
  isLoaded: boolean;
  isPlaying: boolean;
}

interface EffectVideoPlayerProps {
  effects?: string[];
  activeEffect: number;
  width?: number;
  height?: number;
  onEffectChange?: (effectNumber: number) => void;
  onStreamReady?: (stream: MediaStream) => void;
  fps?: number;
}

const DEFAULT_EFFECTS = [
  "/effect1.mp4",
  "/effect2.mp4",
  "/effect3.mp4",
  "/effect4.mp4",
  "/effect5.mp4",
];

const EFFECT_NAMES = [
  "Grid Pulse",
  "Wave Flow",
  "Particle Storm",
  "Geometric Drift",
  "Liquid Motion",
];

function getRandomEffectIndex(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

function loadEffectVideo(
  effectNumber: number,
  url: string,
  container: HTMLDivElement
): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const timeout = setTimeout(() => {
      reject(new Error(`Timeout loading effect ${effectNumber}`));
    }, 10000);

    video.onloadeddata = () => {
      clearTimeout(timeout);
      console.log(`[EffectVideo] Effect ${effectNumber} loaded`);
      resolve(video);
    };

    video.oncanplaythrough = () => {
      clearTimeout(timeout);
      console.log(`[EffectVideo] Effect ${effectNumber} ready to play`);
      resolve(video);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      console.error(`[EffectVideo] Failed to load effect ${effectNumber}`);
      reject(new Error(`Failed to load effect ${effectNumber}`));
    };

    container.appendChild(video);
  });
}

export default function EffectVideoPlayer({
  effects = DEFAULT_EFFECTS,
  activeEffect,
  width = 1280,
  height = 720,
  onStreamReady,
  fps = 15,
}: EffectVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamReadyCalledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitializedRef = useRef(false);
  const isLoadingRef = useRef<Record<number, boolean>>({});
  const currentActiveRef = useRef<number | null>(null);

  const [loadState, setLoadState] = useState<Record<number, boolean>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingEffect, setLoadingEffect] = useState<number | null>(null);

  const loadSingleEffect = useCallback(
    async (effectNumber: number): Promise<HTMLVideoElement | null> => {
      if (videoRefs.current.has(effectNumber)) {
        return videoRefs.current.get(effectNumber)!;
      }

      if (isLoadingRef.current[effectNumber]) {
        return null;
      }

      const container = containerRef.current;
      if (!container) return null;

      isLoadingRef.current[effectNumber] = true;
      setLoadingEffect(effectNumber);

      try {
        const url = effects[effectNumber - 1];
        if (!url) throw new Error(`No URL for effect ${effectNumber}`);

        const video = await loadEffectVideo(effectNumber, url, container);
        videoRefs.current.set(effectNumber, video);
        isLoadingRef.current[effectNumber] = false;
        setLoadState((prev) => ({ ...prev, [effectNumber]: true }));
        setLoadingEffect(null);
        return video;
      } catch (err) {
        console.error(`[EffectVideo] Error loading effect ${effectNumber}:`, err);
        isLoadingRef.current[effectNumber] = false;
        setLoadingEffect(null);
        return null;
      }
    },
    [effects]
  );

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    containerRef.current = container;

    const initialEffect = getRandomEffectIndex(effects.length);
    currentActiveRef.current = initialEffect;
    
    loadSingleEffect(initialEffect).then((video) => {
      setIsInitialLoading(false);
      if (video) {
        video.play().catch(() => {});
      }
    });

    return () => {
      videoRefs.current.forEach((video) => {
        video.pause();
        video.src = "";
        video.load();
      });
      videoRefs.current.clear();

      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }
      containerRef.current = null;
      isInitializedRef.current = false;
      isLoadingRef.current = {};
      currentActiveRef.current = null;
    };
  }, [effects, loadSingleEffect]);

  useEffect(() => {
    if (activeEffect === currentActiveRef.current) return;
    if (loadingEffect) return;

    console.log(`[EffectVideo] Switching to effect ${activeEffect}`);

    const switchToEffect = async () => {
      const video = videoRefs.current.get(activeEffect);

      if (video) {
        videoRefs.current.forEach((v, num) => {
          if (num === activeEffect) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
        currentActiveRef.current = activeEffect;
      } else {
        const loadedVideo = await loadSingleEffect(activeEffect);
        if (loadedVideo) {
          videoRefs.current.forEach((v, num) => {
            if (num === activeEffect) {
              v.play().catch(() => {});
            } else {
              v.pause();
            }
          });
          currentActiveRef.current = activeEffect;
        }
      }
    };

    switchToEffect();
  }, [activeEffect, loadingEffect, loadSingleEffect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastFrameTime = 0;
    const frameInterval = 1000 / fps;

    const drawFrame = (timestamp: number) => {
      if (timestamp - lastFrameTime >= frameInterval) {
        const activeVideo = videoRefs.current.get(activeEffect);
        if (activeVideo && activeVideo.readyState >= 2) {
          ctx.drawImage(activeVideo, 0, 0, width, height);
        }
        lastFrameTime = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    animationFrameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [activeEffect, width, height, fps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onStreamReady || streamReadyCalledRef.current) return;

    const stream = canvas.captureStream(fps);
    streamRef.current = stream;
    streamReadyCalledRef.current = true;

    console.log(`[EffectVideo] Stream ready: ${stream.getVideoTracks().length} video tracks`);
    onStreamReady(stream);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      streamReadyCalledRef.current = false;
    };
  }, [fps, onStreamReady]);

  const effectInfos: EffectInfo[] = effects.map((url, index) => ({
    number: index + 1,
    url,
    name: EFFECT_NAMES[index] || `Effect ${index + 1}`,
    isLoaded: loadState[index + 1] ?? false,
    isPlaying: currentActiveRef.current === index + 1,
  }));

  return (
    <div className="relative hidden" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ width, height }}
      />

      <div className="absolute bottom-2 left-2 flex gap-1 z-10">
        {effectInfos.map((effect) => (
          <div
            key={effect.number}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              effect.number === activeEffect
                ? "bg-yellow-500 text-black scale-110"
                : effect.isLoaded
                ? "bg-white/20 text-white/70 hover:bg-white/30"
                : "bg-white/10 text-white/30"
            }`}
            title={`${effect.name}${effect.isLoaded ? " (loaded)" : " (loading...)"}`}
          >
            {loadingEffect === effect.number ? (
              <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              effect.number
            )}
          </div>
        ))}
      </div>

      {isInitialLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white/70 text-sm">Loading effect...</div>
        </div>
      )}
    </div>
  );
}

export { EFFECT_NAMES, DEFAULT_EFFECTS };
