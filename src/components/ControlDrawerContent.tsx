"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Music, Video, Layers, Radio, Wifi, WifiOff, Plus, X, ChevronDown, Loader2, RefreshCw, RotateCcw, Trash2, Mic, Link2 } from "lucide-react";
import { ShowSettings, saveSettings } from "./OnboardingModal";
import { AGENTS, AgentHead, Agent } from "./AgentSprite";
import { ActiveControlPanel } from "./SetControlHub";
import { getBackendUrl } from "@/hooks/useScopeServer";
import { AgentLog, AgentRuntimeMetrics } from "@/hooks/useAgentBrain";
import { AudioReactiveHealth } from "@/hooks/useAudioReactive";

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
  currentParameters?: Record<string, any>;
  onStreamReady?: (stream: MediaStream | null) => void;
  onFileStreamReady?: (stream: MediaStream | null, videoElement: HTMLVideoElement) => void;
  onAudioFileReady?: (stream: MediaStream | null, audioElement: HTMLAudioElement) => void;
  onInputSourceChange?: (source: "hls" | "video_file" | "audio_file" | "external_audio") => void;
  agentLogs?: AgentLog[];
  agent?: Agent | null;
  onClearLogs?: () => void;
  onResumeAgent?: () => void;
  userOverrideActive?: boolean;
  onUserOverride?: () => void;
  agentRuntime?: AgentRuntimeMetrics;
  agentAudioHealth?: AudioReactiveHealth;
  activeAgent?: Agent | null;
  onAgentSelect?: (agent: Agent) => void;
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
  currentParameters = {},
  onStreamReady,
  onFileStreamReady,
  onAudioFileReady,
  onInputSourceChange,
  agentLogs = [],
  agent = null,
  onClearLogs,
  onResumeAgent,
  userOverrideActive = false,
  onUserOverride,
  agentRuntime,
  agentAudioHealth,
  activeAgent,
  onAgentSelect,
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
        onAudioFileReady={onAudioFileReady}
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
        currentParameters={currentParameters}
      />
    );
  }

  if (panel === "agent") {
    return (
      <AgentPanel
        settings={settings}
        onSettingsChange={updateSettings}
        activeAgent={activeAgent}
        onAgentSelect={onAgentSelect}
      />
    );
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
        onUserOverride={onUserOverride}
        agentRuntime={agentRuntime}
        agentAudioHealth={agentAudioHealth}
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
  onAudioFileReady,
  onInputSourceChange,
}: {
  settings: ShowSettings | null;
  onSettingsChange: (updates: Partial<ShowSettings>) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onFileStreamReady?: (stream: MediaStream | null, videoElement: HTMLVideoElement) => void;
  onAudioFileReady?: (stream: MediaStream | null, audioElement: HTMLAudioElement) => void;
  onInputSourceChange?: (source: "hls" | "video_file" | "audio_file" | "external_audio") => void;
}) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [externalAudioStatus, setExternalAudioStatus] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const videoFileRef = useRef<HTMLVideoElement | null>(null);
  const audioFileRef = useRef<HTMLAudioElement | null>(null);

  const stopAllSources = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoFileRef.current) {
      videoFileRef.current.pause();
      videoFileRef.current.src = "";
      videoFileRef.current = null;
    }
    if (audioFileRef.current) {
      audioFileRef.current.pause();
      audioFileRef.current.src = "";
      audioFileRef.current = null;
    }
  }, []);

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

      await video.play();

      const videoWithCapture = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = (videoWithCapture.captureStream?.() || videoWithCapture.mozCaptureStream?.()) as MediaStream;
      streamRef.current = stream;
      setVideoFile(file);
      onStreamReady?.(stream);
      onFileStreamReady?.(stream, video);
      onInputSourceChange?.("video_file");
      onSettingsChange({ inputType: 'video' });
    } catch (err) {
      console.error('Failed to process uploaded video:', err);
    }
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const audio = document.createElement("audio");
      audio.src = URL.createObjectURL(file);
      audio.loop = true;
      audio.autoplay = true;
      audio.controls = false;
      audioFileRef.current = audio;

      await audio.play();

      const audioWithCapture = audio as HTMLAudioElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = (audioWithCapture.captureStream?.() || audioWithCapture.mozCaptureStream?.()) as MediaStream;
      streamRef.current = stream;
      setAudioReady(true);
      setAudioFile(file);
      onStreamReady?.(stream);
      onAudioFileReady?.(stream, audio);
      onInputSourceChange?.("audio_file");
      onSettingsChange({ inputType: "audio" });
    } catch (err) {
      console.error("Failed to load audio file:", err);
    }
  };

  const handleUseHls = () => {
    stopAllSources();
    setVideoFile(null);
    setAudioFile(null);
    setAudioReady(false);
    onStreamReady?.(null);
    onInputSourceChange?.("hls");
    onSettingsChange({ inputType: "hls" as any });
  };

  const handleUseMicrophone = async () => {
    try {
      stopAllSources();
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const micAudio = document.createElement("audio");
      micAudio.srcObject = micStream;
      micAudio.autoplay = true;
      micAudio.controls = false;
      micAudio.muted = true;
      micAudio.dataset.inputSource = "external_audio";
      audioFileRef.current = micAudio;
      streamRef.current = micStream;
      setExternalAudioStatus("Live mic/line-in connected");
      onStreamReady?.(micStream);
      onAudioFileReady?.(micStream, micAudio);
      onInputSourceChange?.("external_audio");
      onSettingsChange({ inputType: "audio" });
    } catch (error) {
      console.error("Failed to access microphone/line-in:", error);
      setExternalAudioStatus("Microphone/line-in access failed");
    }
  };

  const handleUseAudioUrl = async () => {
    if (!audioUrl.trim()) return;
    try {
      stopAllSources();
      const audio = document.createElement("audio");
      audio.src = audioUrl.trim();
      audio.autoplay = true;
      audio.controls = false;
      audio.crossOrigin = "anonymous";
      audio.dataset.inputSource = "external_audio";
      audioFileRef.current = audio;
      await audio.play();
      const audioWithCapture = audio as HTMLAudioElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = (audioWithCapture.captureStream?.() || audioWithCapture.mozCaptureStream?.()) as MediaStream;
      streamRef.current = stream;
      setExternalAudioStatus("External audio URL connected");
      onStreamReady?.(stream);
      onAudioFileReady?.(stream, audio);
      onInputSourceChange?.("external_audio");
      onSettingsChange({ inputType: "audio" });
    } catch (error) {
      console.error("Failed to connect audio URL:", error);
      setExternalAudioStatus("External audio URL failed");
    }
  };

  useEffect(() => {
    return () => {
      stopAllSources();
    };
  }, [stopAllSources]);

  return (
    <div className="mt-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">File Inputs</div>

      {/* <button
        onClick={handleUseHls}
        className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[10px] uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20"
      >
        Use Live HLS Input
      </button>
      <button
        onClick={handleUseMicrophone}
        className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20 flex items-center justify-center gap-2"
      >
        <Mic className="h-3.5 w-3.5" />
        Use Mic / Line-In Audio
      </button> */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
        <div className="text-[9px] uppercase tracking-wider text-white/50">External Audio URL</div>
        <div className="flex gap-2">
          <input
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://.../live-audio.mp3"
            className="flex-1 rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white/70"
          />
          <button
            onClick={handleUseAudioUrl}
            className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/10 flex items-center gap-1"
          >
            <Link2 className="h-3 w-3" />
            Connect
          </button>
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
              accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
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

      {audioReady && (
        <div className="text-[10px] uppercase tracking-wider text-green-400">
          Audio file stream ready
        </div>
      )}
      {externalAudioStatus && (
        <div className="text-[10px] uppercase tracking-wider text-cyan-300">
          {externalAudioStatus}
        </div>
      )}
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
  currentParameters,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  configSchema: Record<string, any> | null;
  onParamChange: (key: string, value: any) => void;
  sendParameterUpdate: (params: Record<string, any>) => void;
  currentParameters: Record<string, any>;
}) {
  const [localParams, setLocalParams] = useState<Record<string, any>>({});

  const getUi = (field: any) => field?.ui || field?.json_schema_extra || {};
  const getMin = (field: any) => {
    if (typeof field.minimum === "number") return field.minimum;
    if (typeof field.min === "number") return field.min;
    if (typeof field.ge === "number") return field.ge;
    return undefined;
  };
  const getMax = (field: any) => {
    if (typeof field.maximum === "number") return field.maximum;
    if (typeof field.max === "number") return field.max;
    if (typeof field.le === "number") return field.le;
    return undefined;
  };
  const getStep = (field: any, inferredType: string) => {
    if (typeof field.step === "number") return field.step;
    if (typeof field.multipleOf === "number") return field.multipleOf;
    return inferredType === "integer" ? 1 : 0.01;
  };
  const inferType = (field: any, ui: any) => {
    if (ui?.component === "toggle") return "boolean";
    if (ui?.component === "slider") return field?.type === "integer" ? "integer" : "number";
    if (ui?.component === "select") return "enum";
    if (Array.isArray(field?.enum) && field.enum.length > 0) return "enum";
    if (field?.type === "integer") return "integer";
    if (field?.type === "number") return "number";
    if (field?.type === "boolean") return "boolean";
    return "string";
  };

  const normalizedSchema = useCallback(() => {
    if (!configSchema) return [] as Array<{ key: string; field: any; ui: any }>;
    const schemaRoot = (configSchema as any).properties ? (configSchema as any).properties : configSchema;
    return Object.entries(schemaRoot)
      .filter(([, field]) => field && typeof field === "object")
      .map(([key, field]) => ({ key, field, ui: getUi(field) }))
      .sort((a, b) => {
        const orderA = typeof a.ui?.order === "number" ? a.ui.order : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.ui?.order === "number" ? b.ui.order : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.key.localeCompare(b.key);
      });
  }, [configSchema]);

  useEffect(() => {
    setLocalParams((prev) => ({ ...prev, ...currentParameters }));
  }, [currentParameters]);

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...localParams, [key]: value };
    setLocalParams(newParams);
    onParamChange(key, value);
    sendParameterUpdate({ [key]: value });
  };

  const resetToSchemaDefaults = () => {
    const fields = normalizedSchema();
    if (!fields.length) return;
    const defaults: Record<string, unknown> = {};
    for (const { key, field } of fields) {
      if ("default" in field) {
        defaults[key] = (field as { default?: unknown }).default;
      }
    }
    setLocalParams(defaults);
    sendParameterUpdate(defaults);
  };

  const renderField = (key: string, field: any) => {
    const value = localParams[key] ?? field.default;
    const ui = getUi(field);
    const inferredType = inferType(field, ui);
    const min = getMin(field);
    const max = getMax(field);
    const step = getStep(field, inferredType);
    const enumOptions = Array.isArray(field?.enum)
      ? field.enum
      : Array.isArray(ui?.options)
        ? ui.options.map((opt: any) => (typeof opt === "string" ? opt : String(opt?.value)))
        : [];

    if (inferredType === "boolean") {
      return (
        <button
          onClick={() => handleParamChange(key, !(value ?? false))}
          className={`relative h-5 w-9 rounded-full transition-colors ${(value ?? false) ? "bg-yellow-500" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${(value ?? false) ? "translate-x-4" : "translate-x-0"
              }`}
            style={{ left: "2px" }}
          />
        </button>
      );
    }

    if ((inferredType === "number" || inferredType === "integer") && min !== undefined && max !== undefined) {
      return (
        <div className="space-y-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={typeof value === "number" ? value : field.default ?? min}
            onChange={(e) =>
              handleParamChange(
                key,
                inferredType === "integer" ? Math.round(Number(e.target.value)) : parseFloat(e.target.value)
              )
            }
            className="w-full h-1.5 rounded-full appearance-none bg-white/20 accent-yellow-500"
          />
          <div className="flex justify-between text-[9px] text-white/40">
            <span>{min}</span>
            <span className="text-yellow-400">
              {typeof value === "number" ? (inferredType === "integer" ? Math.round(value) : value.toFixed(2)) : String(value ?? "")}
            </span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    if (inferredType === "enum" && enumOptions.length > 0) {
      return (
        <select
          value={String(value ?? enumOptions[0] ?? "")}
          onChange={(e) => handleParamChange(key, e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white/70"
        >
          {enumOptions.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={inferredType === "number" || inferredType === "integer" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) =>
          handleParamChange(
            key,
            inferredType === "number" || inferredType === "integer"
              ? (e.target.value === "" ? "" : Number(e.target.value))
              : e.target.value
          )
        }
        className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white/70"
      />
    );
  };

  return (
    <div className="mt-4 space-y-4 overflow-y-auto">
      {/* <div className="flex items-center gap-2">
        <button
          onClick={onConnect}
          disabled={isConnected || isConnecting}
          className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-green-300 disabled:opacity-40"
        >
          {isConnecting ? "Connecting..." : "Start"}
        </button>
        <button
          onClick={onDisconnect}
          disabled={!isConnected}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-red-300 disabled:opacity-40"
        >
          Stop
        </button>
        <button
          onClick={resetToSchemaDefaults}
          disabled={!configSchema}
          className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 disabled:opacity-40"
        >
          Reset Defaults
        </button>
      </div> */}

      {configSchema && (
        <div className="space-y-3 ">
          {normalizedSchema().map(({ key, field, ui }) => (
            <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <label className="text-[9px] uppercase tracking-wider text-white/60 block mb-1">
                {(ui?.label as string) || field.description || key}
              </label>
              <div className="mb-2 text-[9px] text-white/35 break-all">{key}</div>
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
  activeAgent,
  onAgentSelect,
}: {
  settings: ShowSettings | null;
  onSettingsChange: (updates: Partial<ShowSettings>) => void;
  activeAgent?: Agent | null;
  onAgentSelect?: (agent: Agent) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Select Agent</div>
      <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[9px] uppercase tracking-wider text-white/70">
        Active: <span className="text-yellow-300">{activeAgent?.name || settings?.agent || "None"}</span>
      </div>

      {AGENTS.map((agent) => {
        const isActive = (activeAgent?.name || settings?.agent) === agent.name;
        return (
          <button
            key={agent.name}
            onClick={() => {
              onSettingsChange({ agent: agent.name });
              onAgentSelect?.(agent);
            }}
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
  onUserOverride,
  agentRuntime,
  agentAudioHealth,
}: { 
  isConnected: boolean;
  logs?: AgentLog[];
  agent?: Agent | null;
  onClearLogs?: () => void;
  onResumeAgent?: () => void;
  userOverrideActive?: boolean;
  onUserOverride?: () => void;
  agentRuntime?: AgentRuntimeMetrics;
  agentAudioHealth?: AudioReactiveHealth;
}) {
  const [viewMode, setViewMode] = useState<"logs" | "runtime">("logs");
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
          setScopeLogs((prev) => {
            const merged = [...prev, ...data.logs].slice(-200);
            const seen = new Set<string>();
            return merged.filter((entry) => {
              const key = `${entry.timestamp}|${entry.source}|${entry.message}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).slice(-100);
          });
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
    ...((logs || []).map((l) => ({
      ...l,
      timestamp: l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp),
    }))),
    ...(scopeLogs.map((l, index) => ({
      id: `scope-${l.timestamp}-${index}`,
      timestamp: Number.isNaN(new Date(l.timestamp).getTime()) ? new Date() : new Date(l.timestamp),
      agent: l.source || "scope",
      type: "system" as const,
      content: l.message,
    }))),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

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
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("logs")}
          className={`rounded px-2 py-1 text-[9px] uppercase tracking-wider ${viewMode === "logs" ? "bg-white/20 text-white" : "bg-white/5 text-white/50"}`}
        >
          Logs
        </button>
        <button
          onClick={() => setViewMode("runtime")}
          className={`rounded px-2 py-1 text-[9px] uppercase tracking-wider ${viewMode === "runtime" ? "bg-white/20 text-white" : "bg-white/5 text-white/50"}`}
        >
          Runtime
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-white/50">Agent Logs</div>
        <div className="flex items-center gap-2">
          {!userOverrideActive && onUserOverride && (
            <button
              onClick={onUserOverride}
              className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-[9px] text-yellow-300 transition-colors"
            >
              Manual
            </button>
          )}
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

      {viewMode === "runtime" ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] space-y-2">
          <RuntimeItem label="Audio Provider" value={agentAudioHealth?.provider || "N/A"} />
          <RuntimeItem label="OSC Bridge" value={agentAudioHealth ? (agentAudioHealth.oscConnected ? "connected" : "disconnected") : "N/A"} />
          <RuntimeItem label="Effective Update Interval" value={agentAudioHealth ? `${Math.round(agentAudioHealth.effectiveUpdateIntervalMs)}ms` : "N/A"} />
          <RuntimeItem label="Last Reasoning" value={agentRuntime?.lastReasoningAt ? formatTime(agentRuntime.lastReasoningAt) : "N/A"} />
          <RuntimeItem label="Last Prompt" value={agentRuntime?.lastPromptAt ? formatTime(agentRuntime.lastPromptAt) : "N/A"} />
          <RuntimeItem label="Next Prompt Earliest" value={agentRuntime?.nextPromptEarliestAt ? formatTime(agentRuntime.nextPromptEarliestAt) : "N/A"} />
          <RuntimeItem label="Last Control Action" value={agentRuntime?.lastControlAt ? formatTime(agentRuntime.lastControlAt) : "N/A"} />
          <RuntimeItem label="Next Control Earliest" value={agentRuntime?.nextControlEarliestAt ? formatTime(agentRuntime.nextControlEarliestAt) : "N/A"} />
          <RuntimeItem label="Reasoning Interval" value={`${Math.round((agentRuntime?.reasoningIntervalMs || 0) / 1000)}s`} />
          <RuntimeItem label="Prompt Interval" value={`${Math.round((agentRuntime?.promptIntervalMs || 0) / 1000)}s`} />
          <RuntimeItem label="Control Interval" value={`${Math.round((agentRuntime?.controlIntervalMs || 0) / 1000)}s`} />
          <RuntimeItem label="Prompts Sent" value={`${agentRuntime?.promptsSent ?? 0}`} />
          <RuntimeItem label="Control Actions Sent" value={`${agentRuntime?.controlsSent ?? 0}`} />
          <RuntimeItem label="Total Actions Executed" value={`${agentRuntime?.totalActionsExecuted ?? 0}`} />
        </div>
      ) : (
      <div className="rounded-lg border border-white/10 bg-black/30 max-h-[300px] overflow-y-auto">
        {allLogs.length === 0 ? (
          <div className="p-4 text-center text-[10px] text-white/40">
            {isPolling ? "Waiting for first agent cycle..." : "Start stream to begin"}
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
                  [{(log.agent || "scope").toUpperCase()}]
                </span>{" "}
                <span className="text-white/30">[{log.type}]</span>{" "}
                <span className="text-white/60">{log.content}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function RuntimeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1">
      <span className="text-white/50 uppercase tracking-wide">{label}</span>
      <span className="text-white/80 font-mono">{value}</span>
    </div>
  );
}
