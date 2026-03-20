"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Music, Video, Layers, Radio, Wifi, WifiOff, Plus, X, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { ShowSettings, saveSettings } from "./OnboardingModal";
import { AGENTS, AgentHead } from "./AgentSprite";
import { ActiveControlPanel } from "./SetControlHub";
import { getBackendUrl } from "@/hooks/useScopeServer";

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
}: ControlDrawerContentProps) {
  const updateSettings = (updates: Partial<ShowSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...updates };
    saveSettings(next);
    onSettingsChange(next);
  };

  if (panel === "input") {
    return <InputPanel settings={settings} onSettingsChange={updateSettings} />;
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
    return <LogPanel isConnected={isConnected} />;
  }

  return null;
}

function InputPanel({
  settings,
  onSettingsChange,
}: {
  settings: ShowSettings | null;
  onSettingsChange: (updates: Partial<ShowSettings>) => void;
}) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const startVideo = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        audio: audioEnabled && selectedAudio ? { deviceId: { exact: selectedAudio } } : false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVideoEnabled(true);
    } catch (err) {
      console.error("Failed to start video:", err);
    }
  }, [selectedVideo, selectedAudio, audioEnabled]);

  const stopVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoEnabled(false);
  }, []);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      stopVideo();
      onSettingsChange({ inputType: "video" });
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
            videoEnabled
              ? "border-green-500/60 bg-green-500/20 text-green-400"
              : "border-white/10 hover:border-white/30 text-white/70"
          }`}
        >
          <Camera className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-wider">Video</span>
        </button>

        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${
            audioEnabled
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
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Active Pipeline</div>

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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
      </div>

      <div className="space-y-3">
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
            className={`relative h-5 w-9 rounded-full transition-colors ${
              ndiEnabled ? "bg-green-500" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                ndiEnabled ? "left-4" : "left-0.5"
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
            className={`h-2 w-2 rounded-full ${
              ndiStatus === "connected" ? "bg-green-500" : "bg-red-500"
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
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              value ? "left-4" : "left-0.5"
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
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Stream Controls</div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-400" />
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">Scope Link</div>
            <div className={`text-[11px] font-medium ${isConnected ? "text-green-400" : "text-red-400"}`}>
              {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Offline"}
            </div>
          </div>
        </div>
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/70 hover:border-white/40"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="rounded-full border border-yellow-500/60 bg-yellow-500/20 px-3 py-1.5 text-[9px] uppercase tracking-wider text-yellow-200 hover:bg-yellow-500/30 disabled:opacity-50"
          >
            Connect
          </button>
        )}
      </div>

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
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all w-full ${
              isActive
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

function LogPanel({ isConnected }: { isConnected: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!isConnected) return;
    try {
      const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/logs`);
      if (response.ok) {
        const data = await response.json();
        if (data.logs) {
          setLogs((prev) => [...prev, ...data.logs].slice(-100));
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && !pollIntervalRef.current) {
      setIsPolling(true);
      fetchLogs();
      pollIntervalRef.current = setInterval(fetchLogs, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [isConnected, fetchLogs]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const clearLogs = () => setLogs([]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-white/50">Agent Log</div>
        <button
          onClick={clearLogs}
          className="text-[9px] uppercase tracking-wider text-white/40 hover:text-white/70"
        >
          Clear
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 max-h-[300px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-4 text-center text-[10px] text-white/40">
            {isPolling ? "Waiting for logs..." : "Not connected"}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log, idx) => (
              <div key={idx} className="px-3 py-1.5 text-[9px] font-mono">
                <span className="text-white/30">[{log.timestamp}]</span>{" "}
                <span className="text-yellow-400">[{log.source}]</span>{" "}
                <span className="text-white/60">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
