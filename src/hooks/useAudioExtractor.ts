"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAudioExtractorOptions {
  hlsUrl?: string;
  micStream?: MediaStream | null;
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
      console.log("[AudioExtractor] Creating audio context...");
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        console.log("[AudioExtractor] AudioContext created, sampleRate:", audioContextRef.current.sampleRate);
      }
      
      const ctx = audioContextRef.current;
      
      if (sourceNodeRef.current) {
        console.log("[AudioExtractor] Disconnecting existing source node");
        sourceNodeRef.current.disconnect();
      }
      if (destNodeRef.current) {
        console.log("[AudioExtractor] Stopping existing destination tracks");
        destNodeRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      
      const videoStream = video.captureStream?.() || new MediaStream();
      hlsStreamRef.current = videoStream;
      
      console.log("[AudioExtractor] Video stream tracks:", videoStream.getVideoTracks().length, "video,", videoStream.getAudioTracks().length, "audio");
      
      destNodeRef.current = ctx.createMediaStreamDestination();
      sourceNodeRef.current = ctx.createMediaStreamSource(videoStream);
      sourceNodeRef.current.connect(destNodeRef.current);
      
      console.log("[AudioExtractor] Audio routing configured successfully");
      return destNodeRef.current.stream;
    } catch (err) {
      console.error("[AudioExtractor] Failed to create audio stream:", err);
      return null;
    }
  }, []);

  const initAudio = useCallback(() => {
    console.log("[AudioExtractor] initAudio called, already initialized:", audioInitializedRef.current);
    if (audioInitializedRef.current) return;
    if (!hlsUrl) {
      console.log("[AudioExtractor] No HLS URL provided");
      return;
    }
    
    audioInitializedRef.current = true;
    setIsLoading(true);
    setError(null);
    console.log("[AudioExtractor] Starting HLS initialization for:", hlsUrl);

    const video = document.createElement("video") as VideoElement;
    video.crossOrigin = "anonymous";
    video.muted = false;
    video.playsInline = true;
    hlsVideoRef.current = video;

    const initPlayer = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          console.log("[AudioExtractor] Using native HLS support");
          video.src = hlsUrl;
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error("Failed to load HLS video"));
          });
        } else {
          console.log("[AudioExtractor] Using hls.js");
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

        console.log("[AudioExtractor] HLS loaded, readyState:", video.readyState);

        try {
          console.log("[AudioExtractor] Attempting to play video...");
          await video.play();
          console.log("[AudioExtractor] Video playing successfully");
        } catch (e) {
          console.log("[AudioExtractor] Autoplay blocked, waiting for user interaction");
        }

        video.onpause = () => {
          console.log("[AudioExtractor] Video paused, attempting to resume...");
          video.play().catch(() => {});
        };

        setIsLoading(false);
        setIsReady(true);
        console.log("[AudioExtractor] Video ready, attempting audio extraction");

        const stream = createAudioStreamFromVideoElement(video);
        if (stream && stream.getAudioTracks().length > 0) {
          console.log("[AudioExtractor] SUCCESS - Audio stream created with", stream.getAudioTracks().length, "tracks");
          setAudioStream(stream);
          setCurrentSource("hls");
          console.log("[AudioExtractor] Notifying parent of audio ready");
          onAudioReady?.(stream);
        } else {
          console.warn("[AudioExtractor] No audio tracks in HLS stream - this stream may be video-only");
          console.warn("[AudioExtractor] Video-only stream - agent will use default/placeholder audio metrics");
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
      console.log("[AudioExtractor] Cleanup - destroying HLS player");
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
    console.log("[AudioExtractor] switchToHls called");
    if (!hlsUrl) return;
    
    if (!audioInitializedRef.current) {
      initAudio();
    }
  }, [hlsUrl, initAudio]);

  const switchToMic = useCallback(() => {
    console.log("[AudioExtractor] switchToMic called, micStream:", !!micStream);
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
      
      console.log("[AudioExtractor] Switched to microphone, tracks:", stream.getAudioTracks().length);
      setAudioStream(stream);
      setCurrentSource("mic");
      onAudioReady?.(stream);
    } catch (err) {
      console.error("[AudioExtractor] Failed to switch to microphone:", err);
    }
  }, [micStream, onAudioReady]);

  useEffect(() => {
    console.log("[AudioExtractor] Mount effect - preferMicOverHls:", preferMicOverHls, "micStream:", !!micStream);
    if (preferMicOverHls && micStream) {
      switchToMic();
    }

    return () => {
      console.log("[AudioExtractor] Unmount - cleaning up resources");
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
