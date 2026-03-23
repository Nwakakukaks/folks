"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AudioReactiveMetrics {
  // Frequency bands
  subBass: number;      // 20-60Hz
  bass: number;         // 60-250Hz
  lowMids: number;      // 250-500Hz
  mids: number;         // 500-2000Hz
  upperMids: number;    // 2000-4000Hz
  highs: number;        // 4000-20000Hz
  
  // Energy metrics
  overall: number;      // Overall energy 0-1
  rms: number;          // RMS level 0-1
  peak: number;         // Peak amplitude 0-1
  dynamics: number;      // Crest factor (peak/rms ratio)
  
  // Spectral features
  spectralCentroid: number;      // Average frequency in Hz
  spectralRolloff: number;       // 85% point in Hz
  spectralFlatness: number;       // 0=tonal, 1=noisy
  spectralFlux: number;           // Change in spectrum
  spectralContrast: number;       // Peak vs valley difference
  spectralSpread: number;         // Spectral standard deviation (Hz)
  spectralEntropy: number;        // Spectral entropy 0-1
  
  // Temporal features
  zeroCrossingRate: number;      // 0=tonal, 1=noisy
  transients: number;            // Attack detection
  rhythmStability: number;       // How steady the rhythm is
  onsetStrength: number;         // Combined onset/transient strength 0-1
  
  // Beat detection
  beatDetected: boolean;
  beatStrength: number;          // 0-1
  tempo: number;                 // BPM
  tempoConfidence: number;        // 0-1
  beatIntervalMs: number;        // Estimated beat interval in milliseconds
  lowHighRatio: number;          // Low-energy / high-energy ratio
  loudnessDb: number;            // Approximate dBFS loudness
  crestFactor: number;           // Peak / RMS ratio
  
  // Mood/character
  mood: MoodCategory;
  dominantRange: 'subBass' | 'bass' | 'lowMids' | 'mids' | 'upperMids' | 'highs';
  energyCharacter: 'calm' | 'balanced' | 'driven';
  
  // Timestamps
  timestamp: number;
  isAnalyzing: boolean;
}

export type MoodCategory = 
  | 'calm'      // Low energy, steady
  | 'groovy'    // Rhythmic, moderate energy
  | 'energetic' // High energy, beat-driven
  | 'chaotic'   // Complex, high transients
  | 'dark'      // Low frequencies dominant
  | 'bright'    // High frequencies present
  | 'warm'      // Mids dominant
  | 'harsh';    // High transients, sharp

interface UseAudioReactiveOptions {
  enabled: boolean;
  sourceStream: MediaStream | null;
  onMetrics?: (metrics: AudioReactiveMetrics) => void;
  fftSize?: number;
  updateIntervalMs?: number;
  provider?: AudioMetricsProvider;
  oscBridgeUrl?: string;
}

export type AudioMetricsProvider = "webaudio" | "osc" | "maxmsp" | "hybrid";

export interface AudioReactiveHealth {
  provider: AudioMetricsProvider;
  oscConnected: boolean;
  oscFailures: number;
  fallbackActive: boolean;
  effectiveUpdateIntervalMs: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const DEFAULT_OSC_BRIDGE_URL = "ws://127.0.0.1:8765";

function buildEmptyMetrics(): AudioReactiveMetrics {
  return {
    subBass: 0, bass: 0, lowMids: 0, mids: 0, upperMids: 0, highs: 0,
    overall: 0, rms: 0, peak: 0, dynamics: 0,
    spectralCentroid: 0, spectralRolloff: 0, spectralFlatness: 0, spectralFlux: 0, spectralContrast: 0, spectralSpread: 0, spectralEntropy: 0,
    zeroCrossingRate: 0, transients: 0, rhythmStability: 0, onsetStrength: 0,
    beatDetected: false, beatStrength: 0, tempo: 0, tempoConfidence: 0, beatIntervalMs: 0, lowHighRatio: 0, loudnessDb: -96, crestFactor: 0,
    mood: "calm", dominantRange: "mids", energyCharacter: "calm",
    timestamp: Date.now(), isAnalyzing: false,
  };
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function normalizeExternalMetrics(
  payload: unknown,
  previous: AudioReactiveMetrics,
): AudioReactiveMetrics | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  const nested = (source.metrics && typeof source.metrics === "object")
    ? (source.metrics as Record<string, unknown>)
    : source;

  const moodCandidate = nested.mood;
  const dominantRangeCandidate = nested.dominantRange;
  const energyCharacterCandidate = nested.energyCharacter;

  const mood =
    typeof moodCandidate === "string"
      ? (moodCandidate as MoodCategory)
      : previous.mood;

  const dominantRange =
    typeof dominantRangeCandidate === "string" &&
    ["subBass", "bass", "lowMids", "mids", "upperMids", "highs"].includes(dominantRangeCandidate)
      ? (dominantRangeCandidate as AudioReactiveMetrics["dominantRange"])
      : previous.dominantRange;

  const energyCharacter =
    typeof energyCharacterCandidate === "string" &&
    ["calm", "balanced", "driven"].includes(energyCharacterCandidate)
      ? (energyCharacterCandidate as AudioReactiveMetrics["energyCharacter"])
      : previous.energyCharacter;

  return {
    ...previous,
    subBass: clamp(toNumber(nested.subBass, previous.subBass)),
    bass: clamp(toNumber(nested.bass, previous.bass)),
    lowMids: clamp(toNumber(nested.lowMids, previous.lowMids)),
    mids: clamp(toNumber(nested.mids, previous.mids)),
    upperMids: clamp(toNumber(nested.upperMids, previous.upperMids)),
    highs: clamp(toNumber(nested.highs, previous.highs)),
    overall: clamp(toNumber(nested.overall, previous.overall)),
    rms: clamp(toNumber(nested.rms, previous.rms)),
    peak: clamp(toNumber(nested.peak, previous.peak)),
    dynamics: clamp(toNumber(nested.dynamics, previous.dynamics), 0, 4),
    spectralCentroid: toNumber(nested.spectralCentroid, previous.spectralCentroid),
    spectralRolloff: toNumber(nested.spectralRolloff, previous.spectralRolloff),
    spectralFlatness: clamp(toNumber(nested.spectralFlatness, previous.spectralFlatness)),
    spectralFlux: clamp(toNumber(nested.spectralFlux, previous.spectralFlux), 0, 4),
    spectralContrast: clamp(toNumber(nested.spectralContrast, previous.spectralContrast), 0, 2),
    spectralSpread: Math.max(0, toNumber(nested.spectralSpread, previous.spectralSpread)),
    spectralEntropy: clamp(toNumber(nested.spectralEntropy, previous.spectralEntropy)),
    zeroCrossingRate: clamp(toNumber(nested.zeroCrossingRate, previous.zeroCrossingRate), 0, 2),
    transients: clamp(toNumber(nested.transients, previous.transients), 0, 2),
    rhythmStability: clamp(toNumber(nested.rhythmStability, previous.rhythmStability)),
    onsetStrength: clamp(toNumber(nested.onsetStrength, previous.onsetStrength)),
    beatDetected: toBoolean(nested.beatDetected, previous.beatDetected),
    beatStrength: clamp(toNumber(nested.beatStrength, previous.beatStrength)),
    tempo: Math.max(0, toNumber(nested.tempo, previous.tempo)),
    tempoConfidence: clamp(toNumber(nested.tempoConfidence, previous.tempoConfidence)),
    beatIntervalMs: Math.max(0, toNumber(nested.beatIntervalMs, previous.beatIntervalMs)),
    lowHighRatio: clamp(toNumber(nested.lowHighRatio, previous.lowHighRatio), 0, 10),
    loudnessDb: toNumber(nested.loudnessDb, previous.loudnessDb),
    crestFactor: clamp(toNumber(nested.crestFactor, previous.crestFactor), 0, 6),
    mood,
    dominantRange,
    energyCharacter,
    timestamp: Date.now(),
    isAnalyzing: true,
  };
}

function calculateSpectralCentroid(data: Uint8Array, sampleRate: number): number {
  let weightedSum = 0;
  let sum = 0;
  const binWidth = sampleRate / (data.length * 2);
  
  for (let i = 0; i < data.length; i++) {
    const magnitude = data[i] / 255;
    const frequency = i * binWidth;
    weightedSum += frequency * magnitude;
    sum += magnitude;
  }
  
  return sum > 0 ? weightedSum / sum : 0;
}

function calculateSpectralRolloff(data: Uint8Array, sampleRate: number): number {
  const totalEnergy = data.reduce((sum, val) => sum + (val / 255) ** 2, 0);
  const threshold = totalEnergy * 0.85;
  
  let cumulativeEnergy = 0;
  const binWidth = sampleRate / (data.length * 2);
  
  for (let i = 0; i < data.length; i++) {
    cumulativeEnergy += (data[i] / 255) ** 2;
    if (cumulativeEnergy >= threshold) {
      return i * binWidth;
    }
  }
  
  return data.length * binWidth;
}

function calculateSpectralFlatness(data: Uint8Array): number {
  let sumLog = 0;
  let sum = 0;
  
  for (let i = 0; i < data.length; i++) {
    const value = (data[i] / 255) + 1e-10;
    sumLog += Math.log(value);
    sum += value;
  }
  
  const geometricMean = Math.exp(sumLog / data.length);
  const arithmeticMean = sum / data.length;
  
  return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
}

function calculateSpectralSpread(data: Uint8Array, sampleRate: number, centroid: number): number {
  let weightedVariance = 0;
  let sum = 0;
  const binWidth = sampleRate / (data.length * 2);

  for (let i = 0; i < data.length; i++) {
    const magnitude = data[i] / 255;
    const frequency = i * binWidth;
    const delta = frequency - centroid;
    weightedVariance += magnitude * delta * delta;
    sum += magnitude;
  }

  return sum > 0 ? Math.sqrt(weightedVariance / sum) : 0;
}

function calculateSpectralEntropy(data: Uint8Array): number {
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] / 255;
  }
  if (sum <= eps) return 0;

  let entropy = 0;
  for (let i = 0; i < data.length; i++) {
    const p = (data[i] / 255) / sum;
    if (p > eps) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(data.length || 1);
  return maxEntropy > 0 ? clamp(entropy / maxEntropy) : 0;
}

function classifyMood(metrics: Partial<AudioReactiveMetrics>): MoodCategory {
  const { overall, bass, highs, transients, beatStrength } = metrics;
  
  if (transients && transients > 0.7 && (overall || 0) < 0.5) return 'harsh';
  if ((overall || 0) > 0.7 && (beatStrength || 0) > 0.6) return 'energetic';
  if ((bass || 0) > 0.5 && (highs || 0) < 0.3) return 'dark';
  if ((highs || 0) > 0.5 && (bass || 0) < 0.4) return 'bright';
  if ((transients || 0) > 0.6) return 'chaotic';
  if ((beatStrength || 0) > 0.5) return 'groovy';
  if ((overall || 0) < 0.3) return 'calm';
  
  return 'warm';
}

function getDominantRange(bands: { subBass: number; bass: number; lowMids: number; mids: number; upperMids: number; highs: number }): AudioReactiveMetrics['dominantRange'] {
  const entries = Object.entries(bands) as [AudioReactiveMetrics['dominantRange'], number][];
  let maxEntry = entries[0];
  
  for (const entry of entries) {
    if (entry[1] > maxEntry[1]) {
      maxEntry = entry;
    }
  }
  
  return maxEntry[0];
}

function getEnergyCharacter(overall: number, beatStrength: number): 'calm' | 'balanced' | 'driven' {
  if (overall < 0.3) return 'calm';
  if (overall > 0.6 && beatStrength > 0.5) return 'driven';
  return 'balanced';
}

export function useAudioReactive({
  enabled,
  sourceStream,
  onMetrics,
  fftSize = 2048,
  updateIntervalMs = 500,
  provider = "webaudio",
  oscBridgeUrl = process.env.NEXT_PUBLIC_OSC_BRIDGE_WS_URL || DEFAULT_OSC_BRIDGE_URL,
}: UseAudioReactiveOptions) {
  const [metrics, setMetrics] = useState<AudioReactiveMetrics>(buildEmptyMetrics);
  const [health, setHealth] = useState<AudioReactiveHealth>({
    provider,
    oscConnected: false,
    oscFailures: 0,
    fallbackActive: provider === "hybrid",
    effectiveUpdateIntervalMs: updateIntervalMs,
  });
  const lastExternalMetricsAtRef = useRef<number>(0);
  const previousBassRef = useRef<number>(0);
  const wsFailureCountRef = useRef<number>(0);
  const lastWsWarnAtRef = useRef<number>(0);
  const oscConnectedRef = useRef<boolean>(false);
  const useWebAudio = provider === "webaudio" || provider === "hybrid";
  const useExternalProvider = provider === "osc" || provider === "maxmsp" || provider === "hybrid";

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  
  const lastBeatTimeRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(0.55);
  const beatCooldownRef = useRef<number>(200);
  const beatHistoryRef = useRef<number[]>([]);
  const previousSpectrumRef = useRef<Uint8Array | null>(null);
  const lastTimeDomainRef = useRef<Uint8Array | null>(null);
  
  const bpmRef = useRef<number>(0);
  const bpmConfidenceRef = useRef<number>(0);
  const lastBpmUpdateRef = useRef<number>(0);
  const beatIntervalMsRef = useRef<number>(0);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !frequencyDataRef.current || !timeDataRef.current) return null;

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    analyserRef.current.getByteFrequencyData(frequencyDataRef.current as Uint8Array<ArrayBuffer>);
    const freqData = frequencyDataRef.current;
    const bufferLength = freqData.length;
    
    analyserRef.current.getByteTimeDomainData(timeDataRef.current as Uint8Array<ArrayBuffer>);
    const timeData = timeDataRef.current;
    
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / bufferLength;
    
    const subBassEnd = Math.floor(60 / binWidth);
    const bassEnd = Math.floor(250 / binWidth);
    const lowMidsEnd = Math.floor(500 / binWidth);
    const midsEnd = Math.floor(2000 / binWidth);
    const upperMidsEnd = Math.floor(4000 / binWidth);
    
    const sumBand = (start: number, end: number) => {
      let sum = 0;
      for (let i = start; i < end && i < bufferLength; i++) {
        sum += (freqData[i] / 255);
      }
      return sum / (end - start);
    };
    
    const subBass = sumBand(0, subBassEnd);
    const bass = sumBand(subBassEnd, bassEnd);
    const lowMids = sumBand(bassEnd, lowMidsEnd);
    const mids = sumBand(lowMidsEnd, midsEnd);
    const upperMids = sumBand(midsEnd, upperMidsEnd);
    const highs = sumBand(upperMidsEnd, bufferLength);
    
    let totalSum = 0;
    for (let i = 0; i < bufferLength; i++) {
      totalSum += (freqData[i] / 255);
    }
    const overall = clamp(totalSum / bufferLength * 3);
    
    let rmsSum = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      rmsSum += normalized * normalized;
      peak = Math.max(peak, Math.abs(normalized));
    }
    const rms = clamp(Math.sqrt(rmsSum / timeData.length) * 2);
    const normalizedPeak = clamp(peak);
    const dynamics = rms > 0 ? normalizedPeak / rms : 0;
    const crestFactor = dynamics;
    const loudnessDb = 20 * Math.log10(Math.max(1e-6, rms));
    
    const spectralCentroid = calculateSpectralCentroid(freqData, sampleRate);
    const spectralRolloff = calculateSpectralRolloff(freqData, sampleRate);
    const spectralFlatness = calculateSpectralFlatness(freqData);
    const spectralSpread = calculateSpectralSpread(freqData, sampleRate, spectralCentroid);
    const spectralEntropy = calculateSpectralEntropy(freqData);
    
    let spectralFlux = 0;
    if (previousSpectrumRef.current) {
      for (let i = 0; i < bufferLength; i++) {
        const diff = (freqData[i] - previousSpectrumRef.current[i]) / 255;
        if (diff > 0) spectralFlux += diff;
      }
      spectralFlux = clamp(spectralFlux / bufferLength * 20);
    }
    previousSpectrumRef.current = new Uint8Array(freqData);
    
    const sortedData = Array.from(freqData).sort((a, b) => a - b);
    const lowQuartile = sortedData[Math.floor(bufferLength * 0.25)] / 255;
    const highQuartile = sortedData[Math.floor(bufferLength * 0.75)] / 255;
    const spectralContrast = clamp((highQuartile - lowQuartile) * 2);
    
    let zcr = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] >= 128) !== (timeData[i - 1] >= 128)) {
        zcr++;
      }
    }
    const zeroCrossingRate = clamp(zcr / timeData.length * 10);
    
    let transients = 0;
    if (lastTimeDomainRef.current) {
      let currentEnergy = 0;
      let previousEnergy = 0;
      for (let i = 0; i < timeData.length; i++) {
        const curr = (timeData[i] - 128) / 128;
        const prev = (lastTimeDomainRef.current[i] - 128) / 128;
        currentEnergy += curr * curr;
        previousEnergy += prev * prev;
      }
      const ratio = Math.sqrt(currentEnergy / (previousEnergy + 1e-10));
      transients = clamp((ratio - 1) * 5);
    }
    lastTimeDomainRef.current = new Uint8Array(timeData);
    
    const now = Date.now();
    let beatDetected = false;
    let beatStrength = 0;
    
    const bassDelta = bass - previousBassRef.current;
    const intervalFromTempo = bpmRef.current > 0 ? Math.round((60000 / bpmRef.current) * 0.55) : 320;
    const effectiveBeatCooldown = Math.max(220, Math.min(900, intervalFromTempo));
    if (
      bass > beatThresholdRef.current &&
      bassDelta > 0.05 &&
      now - lastBeatTimeRef.current > effectiveBeatCooldown
    ) {
      beatDetected = true;
      beatStrength = clamp(bass);
      lastBeatTimeRef.current = now;
      beatHistoryRef.current.push(now);
      
      if (beatHistoryRef.current.length > 10) {
        beatHistoryRef.current.shift();
      }
      if (beatHistoryRef.current.length >= 2) {
        const last = beatHistoryRef.current[beatHistoryRef.current.length - 1];
        const prev = beatHistoryRef.current[beatHistoryRef.current.length - 2];
        beatIntervalMsRef.current = Math.max(0, last - prev);
      }
      
      beatThresholdRef.current = Math.max(0.4, bass * 0.85);
    } else {
      beatThresholdRef.current = Math.min(0.7, beatThresholdRef.current + 0.0005);
    }
    previousBassRef.current = bass;
    
    let rhythmStability = 0;
    if (beatHistoryRef.current.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < beatHistoryRef.current.length; i++) {
        intervals.push(beatHistoryRef.current[i] - beatHistoryRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
      rhythmStability = clamp(1 - (variance / avgInterval));
    }
    
    if (beatHistoryRef.current.length >= 4) {
      const intervals: number[] = [];
      for (let i = 1; i < beatHistoryRef.current.length; i++) {
        intervals.push(beatHistoryRef.current[i] - beatHistoryRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const estimatedBpm = 60000 / avgInterval;
      beatIntervalMsRef.current = avgInterval;
      
      if (now - lastBpmUpdateRef.current > 5000) {
        if (estimatedBpm >= 60 && estimatedBpm <= 200) {
          bpmRef.current = bpmRef.current > 0 
            ? bpmRef.current * 0.7 + estimatedBpm * 0.3 
            : estimatedBpm;
          bpmConfidenceRef.current = clamp(rhythmStability * 0.8);
          lastBpmUpdateRef.current = now;
        }
      }
    }
    
    const mood = classifyMood({ overall, bass, highs, transients, beatStrength });
    const dominantRange = getDominantRange({ subBass, bass, lowMids, mids, upperMids, highs });
    const energyCharacter = getEnergyCharacter(overall, beatStrength);
    const onsetStrength = clamp((spectralFlux * 0.5) + (transients * 0.5));
    const lowHighRatio = (subBass + bass + lowMids) / Math.max(1e-4, highs + upperMids);
    
    return {
      subBass: clamp(subBass * 1.15),
      bass: clamp(bass * 1.2),
      lowMids: clamp(lowMids * 1.15),
      mids: clamp(mids * 1.15),
      upperMids: clamp(upperMids * 1.1),
      highs: clamp(highs * 1.1),
      overall: clamp(overall * 1.05),
      rms: clamp(rms * 1.1),
      peak: normalizedPeak,
      dynamics: clamp(dynamics),
      spectralCentroid,
      spectralRolloff,
      spectralFlatness: clamp(spectralFlatness * 1.3),
      spectralFlux,
      spectralContrast,
      spectralSpread,
      spectralEntropy,
      zeroCrossingRate,
      transients,
      rhythmStability,
      onsetStrength,
      beatDetected,
      beatStrength,
      tempo: bpmRef.current,
      tempoConfidence: bpmConfidenceRef.current,
      beatIntervalMs: beatIntervalMsRef.current,
      lowHighRatio: clamp(lowHighRatio, 0, 10),
      loudnessDb,
      crestFactor: clamp(crestFactor, 0, 6),
      mood,
      dominantRange,
      energyCharacter,
      timestamp: now,
      isAnalyzing: true,
    };
  }, []);

  useEffect(() => {
    if (!enabled || !useWebAudio || !sourceStream) {
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
      timeDataRef.current = null;
      return;
    }

    const audioTrack = sourceStream.getAudioTracks()[0];
    if (!audioTrack) {
      return;
    }

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.6;

      const source = audioContext.createMediaStreamSource(sourceStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.fftSize);
      
      beatHistoryRef.current = [];
      beatThresholdRef.current = 0.55;
      bpmRef.current = 0;
      bpmConfidenceRef.current = 0;
      beatIntervalMsRef.current = 0;
    } catch (err) {
      console.error("[AudioReactive] Failed to setup audio:", err);
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
      timeDataRef.current = null;
    };
  }, [enabled, sourceStream, fftSize, useWebAudio]);

  useEffect(() => {
    setHealth((prev) => ({
      ...prev,
      provider,
      fallbackActive: provider === "hybrid" && !oscConnectedRef.current,
      effectiveUpdateIntervalMs: updateIntervalMs,
    }));
  }, [provider, updateIntervalMs]);

  useEffect(() => {
    if (!enabled || !useExternalProvider) return;

    let isCancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (isCancelled) return;
      try {
        ws = new WebSocket(oscBridgeUrl);
      } catch (err) {
        reconnectTimer = setTimeout(connect, 2500);
        return;
      }

      ws.onopen = () => {
        oscConnectedRef.current = true;
        wsFailureCountRef.current = 0;
        setHealth((prev) => ({
          ...prev,
          oscConnected: true,
          oscFailures: 0,
          fallbackActive: provider === "hybrid" ? false : prev.fallbackActive,
        }));
        try {
          ws?.send(JSON.stringify({ type: "subscribe", channel: "audio_metrics" }));
        } catch {}
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string);
          setMetrics((prev) => {
            const payload = parsed?.data ?? parsed;
            const normalized = normalizeExternalMetrics(payload, prev);
            if (!normalized) return prev;
            lastExternalMetricsAtRef.current = normalized.timestamp;
            onMetrics?.(normalized);
            return normalized;
          });
        } catch {}
      };

      ws.onerror = () => {
        const now = Date.now();
        if (now - lastWsWarnAtRef.current > 20000) {
          console.warn("[AudioReactive] OSC/Max bridge unavailable; using local WebAudio metrics.");
          lastWsWarnAtRef.current = now;
        }
      };

      ws.onclose = () => {
        oscConnectedRef.current = false;
        if (!isCancelled) {
          wsFailureCountRef.current += 1;
          const backoffMs = Math.min(30000, 2500 * wsFailureCountRef.current);
          setHealth((prev) => ({
            ...prev,
            oscConnected: false,
            oscFailures: wsFailureCountRef.current,
            fallbackActive: provider === "hybrid",
          }));
          reconnectTimer = setTimeout(connect, backoffMs);
        }
      };
    };

    connect();

    return () => {
      isCancelled = true;
      oscConnectedRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [enabled, useExternalProvider, oscBridgeUrl, onMetrics, provider]);

  useEffect(() => {
    if (!enabled || !useWebAudio) {
      if (!enabled) {
        setMetrics(prev => ({ ...prev, isAnalyzing: false }));
      }
      return;
    }

    let animationId: number;
    let lastUpdateAt = 0;

    const analyze = (now: number) => {
      if (now - lastUpdateAt >= updateIntervalMs) {
        lastUpdateAt = now;
        const result = processAudio();
        if (result) {
          const externalIsFresh = Date.now() - lastExternalMetricsAtRef.current < 1200;
          if (provider === "hybrid" && externalIsFresh) {
            animationId = requestAnimationFrame(analyze);
            return;
          }

          setMetrics(result);
          onMetrics?.(result);
        }
      }
      animationId = requestAnimationFrame(analyze);
    };

    animationId = requestAnimationFrame(analyze);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [enabled, useWebAudio, processAudio, onMetrics, updateIntervalMs, provider]);

  return {
    metrics,
    isAnalyzing: metrics.isAnalyzing,
    health,
  };
}
