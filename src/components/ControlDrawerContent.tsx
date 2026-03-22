"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Music, Video, Layers, Radio, Wifi, WifiOff, Plus, X, ChevronDown, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { ShowSettings, saveSettings } from "./OnboardingModal";
import { AGENTS, AgentHead, Agent } from "./AgentSprite";
import { ActiveControlPanel } from "./SetControlHub";
import { getBackendUrl } from "@/hooks/useScopeServer";
import { AgentLog } from "@/hooks/useAgentBrain";

const SCOPE_API_URL = "/api/scope";

interface ControlDrawerContentProps {
  panel: Exclude<ActiveControlPanel, null>;
  settings: ShowSettings | null;
  onSettingsChange: (settings: ShowSettings) => void;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  pipelines: Record<string, { name: string; description?: string }>;
  activePipeline: string | null;
  onPipelineChange: (pipelineId: string) => void;
  onLoadPipeline: () => void;
  isLoadingPipeline: boolean;
  configSchema: Record<string, any> | null;
  onParamChange: (key: string, value: any) => void;
  sendParameterUpdate: (params: Record<string, any>) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onFileStreamReady?: (stream: MediaStream | null, videoElement: HTMLVideoElement) => void;
  onInputSourceChange?: (source: 'webcam' | 'file' | 'hls') => void;
  agentLogs?: AgentLog[];
  agent?: Agent | null;
  onClearLogs?: () => void;
  onResumeAgent?: () => void;
  userOverrideActive?: boolean;
  onUserOverride?: () => void;
}

interface LogEntry {
  timestamp: string;
  source: string;
  message: string;
}

export function getPanelTitle(panel: Exclude<ActiveControlPanel, null>) {
  const titles: Record<string, string> = {
    input: "Input Source",
    pipeline: "Pipelines",
    output: "Output",
    controls: "Controls",
    agent: "Agent",
    log: "Log",
  };
  return titles[panel] || panel;
}

export default function ControlDrawerContent({
  panel,
  settings,
  onSettingsChange,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  pipelines,
  activePipeline,
  onPipelineChange,
  onLoadPipeline,
  isLoadingPipeline,
  configSchema,
  onParamChange,
  sendParameterUpdate,
  onStreamReady,
  onFileStreamReady,
  onInputSourceChange,
  agentLogs = [],
  agent = null,
  onClearLogs,
  onResumeAgent,
  userOverrideActive = false,
  onUserOverride,
}: ControlDrawerContentProps) {
  const updateSettings = (updates: Partial<ShowSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...updates };
    saveSettings(next);
    onSettingsChange(next);
  };

  if (panel === "input") {
    return (
      <InputPanel
        settings={settings}
        onSettingsChange={updateSettings}
        onStreamReady={onStreamReady}
        onFileStreamReady={onFileStreamReady}
        onInputSourceChange={onInputSourceChange}
      />
    );
  }

  if (panel === "pipeline") {
    return (
      <PipelinePanel
        pipelines={pipelines}
        activePipeline={activePipeline}
        onPipelineChange={onPipelineChange}
        onLoadPipeline={onLoadPipeline}
        isLoadingPipeline={isLoadingPipeline}
      />
    );
  }

  if (panel === "output") {
    return <OutputPanel isConnected={isConnected} />;
  }

  if (panel === "controls") {
    return (
      <ControlsPanel
        isConnected={isConnected}
        isConnecting={isConnecting}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        configSchema={configSchema}
        onParamChange={onParamChange}
        sendParameterUpdate={sendParameterUpdate}
      />
    );
  }

  if (panel === "agent") {
    return <AgentPanel settings={settings} onSettingsChange={updateSettings} />;
  }

  if (panel === "log") {
    return (
      <LogPanel 
        isConnected={isConnected} 
        logs={agentLogs}
        agent={settings?.agent ? AGENTS.find(a => a.name === settings?.agent) : null}
        onClearLogs={onClearLogs}
        onResumeAgent={onResumeAgent}
        userOverrideActive={userOverrideActive}
      />
    );
  }

  return null;
}

function InputPanel({
  settings,
  onSettingsChange,
  onStreamReady,
  onFileStreamReady,
  onInputSourceChange,
}: {
  settings: ShowSettings | null;
  onSettingsChange: (updates: Partial<ShowSettings>) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onFileStreamReady?: (stream: MediaStream | null, videoElement: HTMLVideoElement) => void;
  onInputSourceChange?: (source: 'webcam' | 'file' | 'hls') => void;
}) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [currentSource, setCurrentSource] = useState<'webcam' | 'file' | 'hls'>('webcam');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoFileRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousLumaRef = useRef<Float32Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
        if (devices.some((d) => d.kind === "audioinput")) {
          setSelectedAudio(devices.find((d) => d.kind === "audioinput")?.deviceId || "");
        }
        if (devices.some((d) => d.kind === "videoinput")) {
          setSelectedVideo(devices.find((d) => d.kind === "videoinput")?.deviceId || "");
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      }
    }
    getDevices();
  }, []);

  const stopAllSources = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoFileRef.current) {
      videoFileRef.current.pause();
      videoFileRef.current.src = "";
      videoFileRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    previousLumaRef.current = null;
  }, []);

  const startVideo = useCallback(async () => {
    try {
      stopAllSources();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        audio: audioEnabled && selectedAudio ? { deviceId: { exact: selectedAudio } } : false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVideoEnabled(true);
      setCurrentSource('webcam');
      onStreamReady?.(stream);
      onInputSourceChange?.('webcam');
      onSettingsChange({ inputType: 'camera' });
    } catch (err) {
      console.error("Failed to start video:", err);
    }
  }, [selectedVideo, audioEnabled, selectedAudio, stopAllSources, onStreamReady, onInputSourceChange, onSettingsChange]);

  const stopVideo = useCallback(() => {
    stopAllSources();
    setVideoEnabled(false);
    setCurrentSource('webcam');
    onStreamReady?.(null);
  }, [stopAllSources, onStreamReady]);

  const detectPerformers = (
    motionMask: Uint8Array,
    width: number,
    height: number,
  ): Array<{ x: number; y: number; size: number }> => {
    const visited = new Uint8Array(width * height);
    const performers: Array<{ x: number; y: number; size: number }> = [];
    const minBlobArea = 24;

    for (let i = 0; i < motionMask.length; i += 1) {
      if (motionMask[i] === 0 || visited[i] === 1) continue;

      const queue = [i];
      visited[i] = 1;
      let area = 0;
      let sumX = 0;
      let sumY = 0;

      while (queue.length > 0) {
        const current = queue.pop()!;
        const y = Math.floor(current / width);
        const x = current - y * width;

        area += 1;
        sumX += x;
        sumY += y;

        const neighbors = [current - 1, current + 1, current - width, current + width];

        for (const n of neighbors) {
          if (n < 0 || n >= motionMask.length) continue;
          if (visited[n] === 1 || motionMask[n] === 0) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }

      if (area >= minBlobArea) {
        performers.push({ x: sumX / area, y: sumY / area, size: area });
      }
    }

    return performers.sort((a, b) => b.size - a.size).slice(0, 8);
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      stopAllSources();

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.autoplay = true;
      videoFileRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video file'));
      });

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = video.videoWidth || 640;
      outputCanvas.height = video.videoHeight || 480;
      canvasRef.current = outputCanvas;
      const outCtx = outputCanvas.getContext('2d');

      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = 160;
      analysisCanvas.height = 90;
      analysisCanvasRef.current = analysisCanvas;
      const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });

      const previewCtx = previewCanvasRef.current?.getContext('2d');

      if (!outCtx || !analysisCtx) {
        console.error('Failed to initialize canvas contexts');
        return;
      }

      await video.play();

      const stream = outputCanvas.captureStream(15);
      streamRef.current = stream;

      const drawFrame = () => {
        if (!videoFileRef.current || !canvasRef.current) {
          animationFrameRef.current = requestAnimationFrame(drawFrame);
          return;
        }

        const outW = canvasRef.current.width;
        const outH = canvasRef.current.height;

        outCtx.drawImage(videoFileRef.current, 0, 0, outW, outH);

        analysisCtx.drawImage(videoFileRef.current, 0, 0, analysisCanvas.width, analysisCanvas.height);
        const frame = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);

        const pixelCount = analysisCanvas.width * analysisCanvas.height;
        const luma = new Float32Array(pixelCount);
        const motionMask = new Uint8Array(pixelCount);

        for (let p = 0; p < pixelCount; p += 1) {
          const idx = p * 4;
          const r = frame.data[idx] / 255;
          const g = frame.data[idx + 1] / 255;
          const b = frame.data[idx + 2] / 255;
          luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        const previous = previousLumaRef.current;
        if (previous) {
          for (let p = 0; p < pixelCount; p += 1) {
            motionMask[p] = Math.abs(luma[p] - previous[p]) > 0.11 ? 1 : 0;
          }
        }
        previousLumaRef.current = luma;

        const performers = detectPerformers(motionMask, analysisCanvas.width, analysisCanvas.height);
        const sx = outW / analysisCanvas.width;
        const sy = outH / analysisCanvas.height;
        const points = performers.map((blob) => ({ x: blob.x * sx, y: blob.y * sy })).sort((a, b) => a.x - b.x);

        if (points.length > 1) {
          outCtx.strokeStyle = 'rgba(255, 230, 120, 0.85)';
          outCtx.lineWidth = 2;
          outCtx.beginPath();
          points.forEach((point, idx) => {
            if (idx === 0) outCtx.moveTo(point.x, point.y);
            else outCtx.lineTo(point.x, point.y);
          });
          outCtx.stroke();
        }

        points.forEach((point) => {
          outCtx.fillStyle = 'rgba(255, 235, 90, 0.95)';
          outCtx.beginPath();
          outCtx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          outCtx.fill();
        });

        if (previewCtx && previewCanvasRef.current) {
          previewCanvasRef.current.width = outW;
          previewCanvasRef.current.height = outH;
          previewCtx.drawImage(canvasRef.current, 0, 0);
        }

        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };

      drawFrame();

      setVideoEnabled(false);
      setVideoFile(file);
      setCurrentSource('file');
      onStreamReady?.(stream);
      onFileStreamReady?.(stream, video);
      onInputSourceChange?.('file');
      onSettingsChange({ inputType: 'video' });
    } catch (err) {
      console.error('Failed to process uploaded video:', err);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      onSettingsChange({ inputType: "audio" });
    }
  };

  useEffect(() => {
    return () => {
      stopAllSources();
    };
  }, [stopAllSources]);

  return (
    <div className="mt-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Input Source</div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (videoEnabled) {
              stopVideo();
            } else {
              startVideo();
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${videoEnabled
            ? "border-green-500/60 bg-green-500/20 text-green-400"
            : "border-white/10 hover:border-white/30 text-white/70"
            }`}
        >
          <Camera className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-wider">Video</span>
        </button>

        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${audioEnabled
            ? "border-green-500/60 bg-green-500/20 text-green-400"
            : "border-white/10 hover:border-white/30 text-white/70"
            }`}
        >
          <Music className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-wider">Audio</span>
        </button>
      </div>

      {videoEnabled && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video rounded-lg bg-black object-contain"
          />
          <select
            value={selectedVideo}
            onChange={(e) => setSelectedVideo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-white/70"
          >
            <option value="">Default Camera</option>
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {audioEnabled && (
        <select
          value={selectedAudio}
          onChange={(e) => setSelectedAudio(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-white/70"
        >
          <option value="">Default Microphone</option>
          {audioDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      )}

      {currentSource === 'file' && (
        <div className="space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-white/40">Tracked Video Preview</div>
          <canvas
            ref={previewCanvasRef}
            className="w-full aspect-video rounded-lg bg-black object-contain border border-white/10"
          />
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[9px] uppercase tracking-wider text-white/40">
          <span className="bg-[#05070f] px-2">or</span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-3 cursor-pointer hover:border-white/30 transition-colors">
            <Video className="h-4 w-4 text-white/50" />
            <span className="text-[10px] uppercase tracking-wider text-white/70">
              {videoFile ? videoFile.name : "Upload Video File"}
            </span>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFileChange}
              className="hidden"
            />
          </label>
          {videoFile && (
            <div className="mt-1 flex items-center justify-between text-[9px] text-white/50">
              <span className="truncate">{videoFile.name}</span>
              <button
                onClick={() => setVideoFile(null)}
                className="p-1 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-3 cursor-pointer hover:border-white/30 transition-colors">
            <Music className="h-4 w-4 text-white/50" />
            <span className="text-[10px] uppercase tracking-wider text-white/70">
              {audioFile ? audioFile.name : "Upload Audio File"}
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioFileChange}
              className="hidden"
            />
          </label>
          {audioFile && (
            <div className="mt-1 flex items-center justify-between text-[9px] text-white/50">
              <span className="truncate">{audioFile.name}</span>
              <button
                onClick={() => setAudioFile(null)}
                className="p-1 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelinePanel({
  pipelines,
  activePipeline,
  onPipelineChange,
  onLoadPipeline,
  isLoadingPipeline,
}: {
  pipelines: Record<string, { name: string; description?: string }>;
  activePipeline: string | null;
  onPipelineChange: (pipelineId: string) => void;
  onLoadPipeline: () => void;
  isLoadingPipeline: boolean;
}) {
  const [preprocessor, setPreprocessor] = useState<string>("");
  const [postprocessor, setPostprocessor] = useState<string>("");

  const pipelineList = Object.entries(pipelines).map(([id, info]) => ({
    id,
    name: info.name || id,
    description: info.description,
  }));

  return (
    <div className="mt-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-white/50 ">Active Pipeline</div>

      <select
        value={activePipeline || ""}
        onChange={(e) => onPipelineChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-xs text-white/70"
      >
        <option value="">Select Pipeline...</option>
        {pipelineList.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {activePipeline && pipelines[activePipeline]?.description && (
        <div className="text-[10px] text-white/40 italic">
          {pipelines[activePipeline].description}
        </div>
      )}



      <div className="space-y-3 mt-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/50 mb-1 block">Preprocessor</label>
          <select
            value={preprocessor}
            onChange={(e) => setPreprocessor(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-white/70"
          >
            <option value="">None</option>
            {pipelineList
              .filter((p) => p.id !== activePipeline)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/50 mb-1 block">Postprocessor</label>
          <select
            value={postprocessor}
            onChange={(e) => setPostprocessor(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-white/70"
          >
            <option value="">None</option>
            {pipelineList
              .filter((p) => p.id !== activePipeline)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <button
        onClick={onLoadPipeline}
        disabled={!activePipeline || isLoadingPipeline}
        className="w-full rounded-lg border border-yellow-500/60 bg-yellow-500/20 px-4 py-2.5 text-[10px] uppercase tracking-wider text-yellow-200 hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoadingPipeline ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Layers className="h-3 w-3" />
            Load Pipeline
          </>
        )}
      </button>
    </div>
  );
}

function OutputPanel({ isConnected }: { isConnected: boolean }) {
  const [ndiEnabled, setNdiEnabled] = useState(false);
  const [ndiName, setNdiName] = useState("Scope-Output");
  const [ndiStatus, setNdiStatus] = useState<"connected" | "disconnected">("disconnected");

  const handleNdiToggle = async () => {
    if (ndiEnabled) {
      setNdiEnabled(false);
      setNdiStatus("disconnected");
    } else {
      try {
        const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/outputs/ndi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true, name: ndiName }),
        });
        if (response.ok) {
          setNdiEnabled(true);
          setNdiStatus("connected");
        }
      } catch (err) {
        console.error("Failed to configure NDI:", err);
      }
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Output Targets</div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-yellow-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/70">NDI Output</span>
          </div>
          <button
            onClick={handleNdiToggle}
            className={`relative h-5 w-9 rounded-full transition-colors ${ndiEnabled ? "bg-green-500" : "bg-white/20"
              }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${ndiEnabled ? "left-4" : "left-0.5"
                }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-wider text-white/40 block">Sender Name</label>
          <input
            type="text"
            value={ndiName}
            onChange={(e) => setNdiName(e.target.value)}
            disabled={ndiEnabled}
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[10px] text-white/70 disabled:opacity-50"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${ndiStatus === "connected" ? "bg-green-500" : "bg-red-500"
              }`}
          />
          <span className="text-[9px] uppercase tracking-wider text-white/50">
            {ndiStatus === "connected" ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ControlsPanel({
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  configSchema,
  onParamChange,
  sendParameterUpdate,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  configSchema: Record<string, any> | null;
  onParamChange: (key: string, value: any) => void;
  sendParameterUpdate: (params: Record<string, any>) => void;
}) {
  const [localParams, setLocalParams] = useState<Record<string, any>>({});

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...localParams, [key]: value };
    setLocalParams(newParams);
    sendParameterUpdate({ [key]: value });
  };

  const renderField = (key: string, field: any) => {
    const value = localParams[key] ?? field.default;

    if (field.type === "boolean") {
      return (
        <button
          onClick={() => handleParamChange(key, !value)}
          className={`h-5 w-9 rounded-full transition-colors ${value ? "bg-yellow-500" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${value ? "left-4" : "left-0.5"
              }`}
            style={{ position: "relative" }}
          />
        </button>
      );
    }

    if (field.type === "number" && field.minimum !== undefined && field.maximum !== undefined) {
      return (
        <div className="space-y-1">
          <input
            type="range"
            min={field.minimum}
            max={field.maximum}
            step={field.step || 0.1}
            value={value}
            onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/20 accent-yellow-500"
          />
          <div className="flex justify-between text-[9px] text-white/40">
            <span>{field.minimum}</span>
            <span className="text-yellow-400">{typeof value === "number" ? value.toFixed(2) : value}</span>
            <span>{field.maximum}</span>
          </div>
        </div>
      );
    }

    if (field.enum) {
      return (
        <select
          value={value}
          onChange={(e) => handleParamChange(key, e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white/70"
        >
          {field.enum.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) =>
          handleParamChange(
            key,
            field.type === "number" ? parseFloat(e.target.value) : e.target.value
          )
        }
        className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white/70"
      />
    );
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Stream Configs</div>
      {configSchema && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Parameters</div>
          {Object.entries(configSchema).map(([key, field]) => (
            <div key={key}>
              <label className="text-[9px] uppercase tracking-wider text-white/40 block mb-1">
                {field.description || key}
              </label>
              {renderField(key, field)}
            </div>
          ))}
        </div>
      )}

      {!configSchema && (
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-4 text-center">
          <div className="text-[10px] text-white/40">
            Load a pipeline to see controls
          </div>
        </div>
      )}
    </div>
  );
}

function AgentPanel({
  settings,
  onSettingsChange,
}: {
  settings: ShowSettings | null;
  onSettingsChange: (updates: Partial<ShowSettings>) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Select Agent</div>

      {AGENTS.map((agent) => {
        const isActive = settings?.agent === agent.name;
        return (
          <button
            key={agent.name}
            onClick={() => onSettingsChange({ agent: agent.name })}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all w-full ${isActive
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 hover:border-white/30"
              }`}
          >
            <div className="relative">
              <svg
                width="36"
                height="36"
                viewBox="0 0 32 32"
                className="agent-sprite"
                style={{ imageRendering: "pixelated" }}
              >
                <AgentHead agent={agent} isActive={isActive} isDancing={false} />
              </svg>
              {isActive && (
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    boxShadow: `0 0 12px ${agent.glowColor}`,
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em]">{agent.name}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">
                {agent.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LogPanel({ 
  isConnected,
  logs,
  agent,
  onClearLogs,
  onResumeAgent,
  userOverrideActive,
}: { 
  isConnected: boolean;
  logs?: AgentLog[];
  agent?: Agent | null;
  onClearLogs?: () => void;
  onResumeAgent?: () => void;
  userOverrideActive?: boolean;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [scopeLogs, setScopeLogs] = useState<LogEntry[]>([]);

  const fetchScopeLogs = useCallback(async () => {
    if (!isConnected) return;
    try {
      const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/logs`);
      if (response.ok) {
        const data = await response.json();
        if (data.logs) {
          setScopeLogs((prev) => [...prev, ...data.logs].slice(-100));
        }
      }
    } catch (err) {
      console.error("Failed to fetch scope logs:", err);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && !pollIntervalRef.current) {
      setIsPolling(true);
      fetchScopeLogs();
      pollIntervalRef.current = setInterval(fetchScopeLogs, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [isConnected, fetchScopeLogs]);

  // Combine agent logs with scope logs
  const allLogs = [
    ...(scopeLogs.map(l => ({
      id: `scope-${l.timestamp}`,
      timestamp: new Date(l.timestamp),
      agent: l.source,
      type: "system" as const,
      content: l.message,
    }))),
    ...(logs || []),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allLogs.length]);

  const AGENT_COLORS: Record<string, string> = {
    echo: "#06b6d4",
    vesper: "#ec4899",
    riley: "#f97316",
    maya: "#a855f7",
    luna: "#22c55e",
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-white/50">Agent Logs</div>
        <div className="flex items-center gap-2">
          {userOverrideActive && onResumeAgent && (
            <button
              onClick={onResumeAgent}
              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-[9px] text-green-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Resume
            </button>
          )}
          <button
            onClick={onClearLogs}
            className="text-[9px] uppercase tracking-wider text-white/40 hover:text-white/70 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {userOverrideActive && (
        <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <span className="text-[10px] text-yellow-400">
            User control active - Agent paused
          </span>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-black/30 max-h-[300px] overflow-y-auto">
        {allLogs.length === 0 ? (
          <div className="p-4 text-center text-[10px] text-white/40">
            {isPolling ? "Agent logs will appear here..." : "Start stream to begin"}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {allLogs.map((log) => (
              <div key={log.id} className="px-3 py-1.5 text-[9px] font-mono">
                <span className="text-white/30">[{formatTime(log.timestamp)}]</span>{" "}
                <span 
                  className="font-medium"
                  style={{ color: AGENT_COLORS[log.agent.toLowerCase()] || "#ffffff" }}
                >
                  [{log.agent.toUpperCase()}]
                </span>{" "}
                <span className="text-white/60">{log.content}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
