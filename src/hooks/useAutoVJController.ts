"use client";

import { useEffect, useRef, useState } from "react";

interface AutoVJMetrics {
  motion: number;
  brightness: number;
  colorEnergy: number;
}

interface UseAutoVJControllerOptions {
  enabled: boolean;
  sourceStream: MediaStream | null;
  onControlFrame: (params: Record<string, unknown>) => void;
  fps?: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function useAutoVJController({
  enabled,
  sourceStream,
  onControlFrame,
  fps = 6,
}: UseAutoVJControllerOptions) {
  const [metrics, setMetrics] = useState<AutoVJMetrics>({
    motion: 0,
    brightness: 0,
    colorEnergy: 0,
  });

  const previousLumaRef = useRef<Float32Array | null>(null);
  const smoothedRef = useRef<AutoVJMetrics>({ motion: 0, brightness: 0, colorEnergy: 0 });

  useEffect(() => {
    if (!enabled || !sourceStream) {
      previousLumaRef.current = null;
      return;
    }

    const video = document.createElement("video");
    video.srcObject = sourceStream;
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const analyzeFrame = () => {
      if (
        cancelled ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const pixels = frame.data;
      const pixelCount = canvas.width * canvas.height;
      const lumaValues = new Float32Array(pixelCount);

      let lumaTotal = 0;
      let saturationTotal = 0;

      for (let px = 0; px < pixelCount; px += 1) {
        const i = px * 4;
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;

        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;

        lumaValues[px] = luma;
        lumaTotal += luma;
        saturationTotal += saturation;
      }

      let motionTotal = 0;
      const previousLuma = previousLumaRef.current;
      if (previousLuma) {
        for (let px = 0; px < pixelCount; px += 4) {
          motionTotal += Math.abs(lumaValues[px] - previousLuma[px]);
        }
      }

      previousLumaRef.current = lumaValues;

      const rawMotion = clamp(motionTotal / (pixelCount / 4) * 6);
      const rawBrightness = clamp(lumaTotal / pixelCount);
      const rawColor = clamp(saturationTotal / pixelCount);

      const alpha = 0.25;
      const nextMetrics: AutoVJMetrics = {
        motion: smoothedRef.current.motion * (1 - alpha) + rawMotion * alpha,
        brightness: smoothedRef.current.brightness * (1 - alpha) + rawBrightness * alpha,
        colorEnergy: smoothedRef.current.colorEnergy * (1 - alpha) + rawColor * alpha,
      };

      smoothedRef.current = nextMetrics;
      setMetrics(nextMetrics);

      const musicalDrive = clamp(nextMetrics.motion * 0.7 + nextMetrics.colorEnergy * 0.3);

      onControlFrame({
        control_source: "video_autopilot",
        motion_energy: round(nextMetrics.motion),
        brightness: round(nextMetrics.brightness),
        color_energy: round(nextMetrics.colorEnergy),
        effect_mix: round(clamp(0.2 + musicalDrive * 0.8)),
        glitch_amount: round(clamp(nextMetrics.motion * 0.9)),
        bloom_strength: round(clamp(nextMetrics.brightness * 0.8 + nextMetrics.motion * 0.2)),
        hue_shift: round(clamp(nextMetrics.colorEnergy * 0.9 + nextMetrics.motion * 0.1)),
        grain_amount: round(clamp((1 - nextMetrics.brightness) * 0.5 + nextMetrics.motion * 0.3)),
      });
    };

    video
      .play()
      .then(() => {
        intervalId = setInterval(analyzeFrame, Math.max(120, Math.floor(1000 / fps)));
      })
      .catch((err) => {
        console.error("[AutoVJ] Failed to start analyzer video:", err);
      });

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      video.pause();
      video.srcObject = null;
      previousLumaRef.current = null;
    };
  }, [enabled, fps, onControlFrame, sourceStream]);

  return metrics;
}
