"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAudioExtractor } from "./useAudioExtractor";

export interface UseAudioVideoStreamOptions {
  hlsUrl?: string;
  inputStream?: MediaStream | null;
  initialEffect?: number;
  preferMicOverHls?: boolean;
  onEffectChange?: (effect: number) => void;
}

export interface UseAudioVideoStreamReturn {
  audioStream: MediaStream | null;
  videoStream: MediaStream | null;
  combinedStream: MediaStream | null;
  selectedEffect: number;
  setEffect: (effect: number) => void;
  isAudioFromUser: boolean;
  audioSource: "hls" | "mic" | null;
  isAudioLoading: boolean;
  audioError: string | null;
  effectsLoaded: Record<number, boolean>;
  updateVideoStream: (stream: MediaStream | null) => void;
}

export function useAudioVideoStream({
  hlsUrl,
  inputStream,
  initialEffect = 1,
  preferMicOverHls = true,
  onEffectChange,
}: UseAudioVideoStreamOptions): UseAudioVideoStreamReturn {
  const [selectedEffect, setSelectedEffect] = useState(initialEffect);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [combinedStream, setCombinedStream] = useState<MediaStream | null>(null);
  const [effectsLoaded, setEffectsLoaded] = useState<Record<number, boolean>>({});

  const videoStreamRef = useRef<MediaStream | null>(null);

  const {
    audioStream,
    currentSource,
    isLoading: isAudioLoading,
    error: audioError,
    switchToMic,
    switchToHls,
  } = useAudioExtractor({
    hlsUrl,
    micStream: inputStream,
    preferMicOverHls,
  });

  const isAudioFromUser = currentSource === "mic";

  const updateVideoStream = useCallback((stream: MediaStream | null) => {
    videoStreamRef.current = stream;
    setVideoStream(stream);
  }, []);

  const handleEffectChange = useCallback(
    (effect: number) => {
      if (effect < 1 || effect > 5) return;
      setSelectedEffect(effect);
      onEffectChange?.(effect);
    },
    [onEffectChange]
  );

  const setEffect = useCallback(
    (effect: number) => {
      handleEffectChange(effect);
    },
    [handleEffectChange]
  );

  useEffect(() => {
    if (inputStream && preferMicOverHls) {
      switchToMic();
    } else if (hlsUrl) {
      switchToHls();
    }
  }, [inputStream, preferMicOverHls, hlsUrl, switchToMic, switchToHls]);

  useEffect(() => {
    if (!audioStream && !videoStreamRef.current) {
      setCombinedStream(null);
      return;
    }

    const combined = new MediaStream();

    if (videoStreamRef.current) {
      videoStreamRef.current.getVideoTracks().forEach((track) => {
        combined.addTrack(track);
      });
    }

    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        combined.addTrack(track);
      });
    }

    setCombinedStream(combined);
  }, [audioStream, videoStream]);

  useEffect(() => {
    const interval = setInterval(() => {
      const loaded: Record<number, boolean> = {};
      for (let i = 1; i <= 5; i++) {
        const video = document.querySelector(`video[data-effect="${i}"]`) as HTMLVideoElement;
        if (video) {
          loaded[i] = video.readyState >= 2;
        } else {
          const allVideos = document.querySelectorAll("video");
          allVideos.forEach((v) => {
            const num = (v as HTMLVideoElement).getAttribute("data-effect-number");
            if (num) {
              loaded[parseInt(num)] = v.readyState >= 2;
            }
          });
        }
      }
      if (Object.keys(loaded).length > 0) {
        setEffectsLoaded(loaded);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    audioStream,
    videoStream,
    combinedStream,
    selectedEffect,
    setEffect,
    isAudioFromUser,
    audioSource: currentSource,
    isAudioLoading,
    audioError,
    effectsLoaded,
    updateVideoStream,
  };
}

export const EFFECT_NAMES = [
  "Grid Pulse",
  "Wave Flow", 
  "Particle Storm",
  "Geometric Drift",
  "Liquid Motion",
];

export const EFFECT_URLS = [
  "/effect1.mp4",
  "/effect2.mp4",
  "/effect3.mp4",
  "/effect4.mp4",
  "/effect5.mp4",
];
