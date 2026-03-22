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
  
  // Temporal features
  zeroCrossingRate: number;      // 0=tonal, 1=noisy
  transients: number;            // Attack detection
  rhythmStability: number;       // How steady the rhythm is
  
  // Beat detection
  beatDetected: boolean;
  beatStrength: number;          // 0-1
  tempo: number;                 // BPM
  tempoConfidence: number;        // 0-1
  
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
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

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
}: UseAudioReactiveOptions) {
  const [metrics, setMetrics] = useState<AudioReactiveMetrics>({
    subBass: 0, bass: 0, lowMids: 0, mids: 0, upperMids: 0, highs: 0,
    overall: 0, rms: 0, peak: 0, dynamics: 0,
    spectralCentroid: 0, spectralRolloff: 0, spectralFlatness: 0, spectralFlux: 0, spectralContrast: 0,
    zeroCrossingRate: 0, transients: 0, rhythmStability: 0,
    beatDetected: false, beatStrength: 0, tempo: 0, tempoConfidence: 0,
    mood: 'calm', dominantRange: 'mids', energyCharacter: 'calm',
    timestamp: Date.now(), isAnalyzing: false,
  });

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
    
    const spectralCentroid = calculateSpectralCentroid(freqData, sampleRate);
    const spectralRolloff = calculateSpectralRolloff(freqData, sampleRate);
    const spectralFlatness = calculateSpectralFlatness(freqData);
    
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
    
    if (bass > beatThresholdRef.current && now - lastBeatTimeRef.current > beatCooldownRef.current) {
      beatDetected = true;
      beatStrength = clamp(bass);
      lastBeatTimeRef.current = now;
      beatHistoryRef.current.push(now);
      
      if (beatHistoryRef.current.length > 10) {
        beatHistoryRef.current.shift();
      }
      
      beatThresholdRef.current = Math.max(0.4, bass * 0.85);
    } else {
      beatThresholdRef.current = Math.min(0.7, beatThresholdRef.current + 0.0005);
    }
    
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
    
    return {
      subBass: clamp(subBass * 2),
      bass: clamp(bass * 2),
      lowMids: clamp(lowMids * 2),
      mids: clamp(mids * 2),
      upperMids: clamp(upperMids * 2),
      highs: clamp(highs * 2),
      overall,
      rms,
      peak: normalizedPeak,
      dynamics: clamp(dynamics),
      spectralCentroid,
      spectralRolloff,
      spectralFlatness: clamp(spectralFlatness * 2),
      spectralFlux,
      spectralContrast,
      zeroCrossingRate,
      transients,
      rhythmStability,
      beatDetected,
      beatStrength,
      tempo: bpmRef.current,
      tempoConfidence: bpmConfidenceRef.current,
      mood,
      dominantRange,
      energyCharacter,
      timestamp: now,
      isAnalyzing: true,
    };
  }, []);

  useEffect(() => {
    console.log("[AudioReactive] Setup effect - enabled:", enabled, "sourceStream:", !!sourceStream);
    if (!enabled || !sourceStream) {
      console.log("[AudioReactive] Disabling analysis");
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
      console.log("[AudioReactive] No audio track in source stream");
      return;
    }

    try {
      console.log("[AudioReactive] Setting up audio analysis...");
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
      console.log("[AudioReactive] Analysis setup complete, frequency bins:", analyser.frequencyBinCount);
    } catch (err) {
      console.error("[AudioReactive] Failed to setup audio:", err);
    }

    return () => {
      console.log("[AudioReactive] Cleanup - disconnecting audio");
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
  }, [enabled, sourceStream, fftSize]);

  useEffect(() => {
    if (!enabled) {
      console.log("[AudioReactive] Stopping analysis loop - disabled");
      setMetrics(prev => ({ ...prev, isAnalyzing: false }));
      return;
    }

    let animationId: number;
    let frameCount = 0;

    const analyze = () => {
      const result = processAudio();
      if (result) {
        if (frameCount % 60 === 0) {
          console.log("[AudioReactive] Metrics update:", {
            overall: result.overall.toFixed(3),
            mood: result.mood,
            beat: result.beatDetected,
            tempo: result.tempo.toFixed(1),
          });
        }
        frameCount++;
        setMetrics(result);
        onMetrics?.(result);
      }
      animationId = requestAnimationFrame(analyze);
    };

    console.log("[AudioReactive] Starting analysis loop");
    animationId = requestAnimationFrame(analyze);

    return () => {
      console.log("[AudioReactive] Stopping analysis loop");
      cancelAnimationFrame(animationId);
    };
  }, [enabled, processAudio, onMetrics]);

  return {
    metrics,
    isAnalyzing: metrics.isAnalyzing,
  };
}
