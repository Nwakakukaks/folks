"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AudioMetrics {
  bass: number;      // 0-1, low frequency energy (0-60Hz)
  mids: number;       // 0-1, mid frequency energy (60Hz-2kHz)
  highs: number;      // 0-1, high frequency energy (2kHz+)
  overall: number;    // 0-1, overall energy
  motion: number;     // 0-1, motion detected in video frames
  beat: boolean;      // True if beat detected
  bpm: number | null; // Estimated BPM if detected
}

interface UseAudioAnalyzerOptions {
  enabled: boolean;
  sourceStream: MediaStream | null;
  onMetrics?: (metrics: AudioMetrics) => void;
  fftSize?: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function useAudioAnalyzer({
  enabled,
  sourceStream,
  onMetrics,
  fftSize = 2048,
}: UseAudioAnalyzerOptions) {
  const [metrics, setMetrics] = useState<AudioMetrics>({
    bass: 0,
    mids: 0,
    highs: 0,
    overall: 0,
    motion: 0,
    beat: false,
    bpm: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  
  // For video motion detection
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Float32Array | null>(null);
  const motionAnimationRef = useRef<number | null>(null);

  // Beat detection state
  const lastBeatTimeRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(0.6);
  const beatCooldownRef = useRef<number>(150); // ms

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !frequencyDataRef.current) return;

    analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
    const data = frequencyDataRef.current;
    const bufferLength = data.length;
    
    // Calculate frequency bands
    // Assuming 44100Hz sample rate, each bin is ~21.5Hz
    // Bass: bins 0-3 (0-60Hz)
    // Mids: bins 3-93 (60Hz-2kHz)
    // Highs: bins 93+ (2kHz+)
    
    const bassEnd = Math.floor(bufferLength * 0.015); // ~60Hz
    const midsEnd = Math.floor(bufferLength * 0.25);    // ~2kHz
    
    let bassSum = 0;
    let midsSum = 0;
    let highsSum = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const normalized = data[i] / 255;
      if (i < bassEnd) {
        bassSum += normalized;
      } else if (i < midsEnd) {
        midsSum += normalized;
      } else {
        highsSum += normalized;
      }
    }
    
    const bassAvg = bassSum / bassEnd;
    const midsAvg = midsSum / (midsEnd - bassEnd);
    const highsAvg = highsSum / (bufferLength - midsEnd);
    const overall = (bassAvg + midsAvg + highsAvg) / 3;

    // Beat detection
    const now = Date.now();
    let beat = false;
    if (bassAvg > beatThresholdRef.current && now - lastBeatTimeRef.current > beatCooldownRef.current) {
      beat = true;
      lastBeatTimeRef.current = now;
      // Adaptive threshold
      beatThresholdRef.current = Math.max(0.4, bassAvg * 0.8);
    } else {
      // Decay threshold
      beatThresholdRef.current = Math.min(0.7, beatThresholdRef.current + 0.001);
    }

    return {
      bass: clamp(bassAvg),
      mids: clamp(midsAvg),
      highs: clamp(highsAvg),
      overall: clamp(overall),
    };
  }, []);

  const processVideoMotion = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return 0;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;

    canvas.width = 64;
    canvas.height = 36;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    const pixelCount = canvas.width * canvas.height;

    // Calculate luma values
    const lumaValues = new Float32Array(pixelCount);
    let lumaTotal = 0;
    
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = pixels[idx] / 255;
      const g = pixels[idx + 1] / 255;
      const b = pixels[idx + 2] / 255;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaValues[i] = luma;
      lumaTotal += luma;
    }

    // Calculate motion from previous frame
    let motion = 0;
    if (previousFrameRef.current) {
      for (let i = 0; i < pixelCount; i++) {
        motion += Math.abs(lumaValues[i] - previousFrameRef.current[i]);
      }
      motion = clamp(motion / (pixelCount * 0.5));
    }

    previousFrameRef.current = lumaValues;
    return motion;
  }, []);

  // Setup audio
  useEffect(() => {
    if (!enabled || !sourceStream) {
      // Cleanup
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      frequencyDataRef.current = null;
      return;
    }

    // Check if stream has audio track
    const audioTrack = sourceStream.getAudioTracks()[0];
    if (!audioTrack) {
      // No audio in stream, we'll still analyze video for motion
      return;
    }

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(sourceStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.error("Failed to setup audio analyzer:", err);
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      frequencyDataRef.current = null;
    };
  }, [enabled, sourceStream, fftSize]);

  // Main analysis loop
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let lastMotionTime = 0;

    const analyze = () => {
      if (cancelled) return;

      const audioMetrics = processAudio();
      const motion = processVideoMotion();

      const newMetrics: AudioMetrics = {
        bass: audioMetrics?.bass ?? 0,
        mids: audioMetrics?.mids ?? 0,
        highs: audioMetrics?.highs ?? 0,
        overall: audioMetrics?.overall ?? 0,
        motion: motion,
        beat: audioMetrics ? audioMetrics.bass > 0.5 : false,
        bpm: null, // TODO: Implement BPM detection if needed
      };

      setMetrics(newMetrics);
      onMetrics?.(newMetrics);

      requestAnimationFrame(analyze);
    };

    // Create video element for motion detection if stream has video
    if (sourceStream && sourceStream.getVideoTracks().length > 0) {
      const video = document.createElement("video");
      video.srcObject = sourceStream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play().catch(console.error);
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    analyze();

    return () => {
      cancelled = true;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
      if (motionAnimationRef.current) {
        cancelAnimationFrame(motionAnimationRef.current);
      }
      previousFrameRef.current = null;
    };
  }, [enabled, sourceStream, processAudio, processVideoMotion, onMetrics]);

  return metrics;
}

// Hook for getting microphone input specifically
export function useMicrophoneInput(enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(setStream)
      .catch((err) => {
        setError(err.message);
        setStream(null);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [enabled]);

  return { stream, error };
}
