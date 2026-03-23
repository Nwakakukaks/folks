"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAudioExtractorOptions {
  hlsUrl?: string;
  micStream?: MediaStream | null;
  videoElement?: HTMLVideoElement;
  preferMicOverHls?: boolean;
  onAudioReady?: (stream: MediaStream) => void;
}

export interface UseAudioExtractorReturn {
  audioStream: MediaStream | null;
  currentSource: "hls" | "mic" | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  switchToMic: () => void;
  switchToHls: () => void;
  initAudio: () => void;
}

interface VideoElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
}

export function useAudioExtractor({
  hlsUrl,
  micStream,
  videoElement,
  preferMicOverHls = true,
  onAudioReady,
}: UseAudioExtractorOptions): UseAudioExtractorReturn {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [currentSource, setCurrentSource] = useState<"hls" | "mic" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const hlsVideoRef = useRef<VideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioInitializedRef = useRef(false);
  const hlsStreamRef = useRef<MediaStream | null>(null);

  const createAudioStreamFromVideoElement = useCallback((video: VideoElement): MediaStream | null => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const ctx = audioContextRef.current;
      
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      if (destNodeRef.current) {
        destNodeRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      
      const videoStream = video.captureStream?.() || new MediaStream();
      hlsStreamRef.current = videoStream;
      
      destNodeRef.current = ctx.createMediaStreamDestination();
      sourceNodeRef.current = ctx.createMediaStreamSource(videoStream);
      sourceNodeRef.current.connect(destNodeRef.current);
      
      return destNodeRef.current.stream;
    } catch (err) {
      console.error("[AudioExtractor] Failed to create audio stream:", err);
      return null;
    }
  }, []);

  const initAudio = useCallback(() => {
    if (audioInitializedRef.current) return;

    const initFromVideoElement = (video: HTMLVideoElement) => {
      audioInitializedRef.current = true;
      setIsLoading(true);
      
      const startExtraction = async () => {
        try {
          await video.play();
          const stream = createAudioStreamFromVideoElement(video as VideoElement);
          if (stream) {
            setAudioStream(stream);
            setCurrentSource("mic");
            setIsLoading(false);
            setIsReady(true);
            onAudioReady?.(stream);
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          console.error("[AudioExtractor] Failed to play video element:", err);
          setIsLoading(false);
        }
      };

      if (video.readyState >= 2) {
        startExtraction();
      } else {
        video.onloadedmetadata = () => startExtraction();
        video.onerror = () => {
          setIsLoading(false);
        };
      }
    };

    const initFromMicStream = (stream: MediaStream) => {
      audioInitializedRef.current = true;
      
      if (stream.getAudioTracks().length > 0) {
        setAudioStream(stream);
        setCurrentSource("mic");
        setIsReady(true);
        onAudioReady?.(stream);
      }
    };

    if (videoElement) {
      initFromVideoElement(videoElement);
      return;
    }

    if (micStream) {
      initFromMicStream(micStream);
      return;
    }

    if (!hlsUrl) {
      return;
    }
    
    audioInitializedRef.current = true;
    setIsLoading(true);
    setError(null);

    const video = document.createElement("video") as VideoElement;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    hlsVideoRef.current = video;

    const initPlayer = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error("Failed to load HLS video"));
          });
        } else {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            hlsRef.current = new Hls({ enableWorker: true, lowLatencyMode: true });
            hlsRef.current.loadSource(hlsUrl);
            hlsRef.current.attachMedia(video);
            await new Promise<void>((resolve, reject) => {
              hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => resolve());
              hlsRef.current.on(Hls.Events.ERROR, (_: any, data: any) => {
                if (data.fatal) reject(new Error("HLS fatal error"));
              });
            });
          } else {
            throw new Error("HLS not supported");
          }
        }

        try {
          await video.play();
        } catch (e) {
        }

        video.onpause = () => {
          video.play().catch(() => {});
        };

        setIsLoading(false);
        setIsReady(true);

        const stream = createAudioStreamFromVideoElement(video);
        if (stream && stream.getAudioTracks().length > 0) {
          setAudioStream(stream);
          setCurrentSource("hls");
          onAudioReady?.(stream);
        } else {
          setAudioStream(stream);
          setCurrentSource("hls");
          setIsReady(true);
          if (stream) {
            onAudioReady?.(stream);
          }
        }
      } catch (err) {
        console.error("[AudioExtractor] Initialization failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize HLS");
        setIsLoading(false);
        audioInitializedRef.current = false;
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hlsVideoRef.current) {
        hlsVideoRef.current.pause();
        hlsVideoRef.current.src = "";
        hlsVideoRef.current = null;
      }
    };
  }, [hlsUrl, createAudioStreamFromVideoElement, onAudioReady]);

  const switchToHls = useCallback(() => {
    if (!hlsUrl) return;
    
    if (!audioInitializedRef.current) {
      initAudio();
    }
  }, [hlsUrl, initAudio]);

  const switchToMic = useCallback(() => {
    if (!micStream) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const ctx = audioContextRef.current;
      
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      if (destNodeRef.current) {
        destNodeRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      
      destNodeRef.current = ctx.createMediaStreamDestination();
      sourceNodeRef.current = ctx.createMediaStreamSource(micStream);
      sourceNodeRef.current.connect(destNodeRef.current);
      
      const stream = destNodeRef.current.stream;
      
      setAudioStream(stream);
      setCurrentSource("mic");
      onAudioReady?.(stream);
    } catch (err) {
      console.error("[AudioExtractor] Failed to switch to microphone:", err);
    }
  }, [micStream, onAudioReady]);

  useEffect(() => {
    if (preferMicOverHls && micStream) {
      switchToMic();
    }

    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (destNodeRef.current) {
        destNodeRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (micStream && preferMicOverHls) {
      switchToMic();
    }
  }, [micStream, preferMicOverHls, switchToMic]);

  return {
    audioStream,
    currentSource,
    isLoading,
    isReady,
    error,
    switchToMic,
    switchToHls,
    initAudio,
  };
}
