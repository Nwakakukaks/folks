"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import MiniHeader from "@/components/MiniHeader";
import EffectVideoPlayer from "@/components/EffectVideoPlayer";
import ShowDisplay from "@/components/ShowDisplay";
import { ShowSettings, loadSettings } from "@/components/OnboardingModal";
import SetControlHub, { ActiveControlPanel } from "@/components/SetControlHub";
import ControlDrawerContent, { getPanelTitle } from "@/components/ControlDrawerContent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import HLSPlayer from "@/components/HLSPlayer";
import { useScopeSession } from "@/context/ScopeSessionContext";
import { useAgentBrain, AgentLog } from "@/hooks/useAgentBrain";
import { useAudioExtractor } from "@/hooks/useAudioExtractor";
import { AudioMetricsProvider, AudioReactiveHealth, useAudioReactive } from "@/hooks/useAudioReactive";
import { useAgentSchedule } from "@/hooks/useAgentSchedule";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { showError, showInfo } from "@/lib/toast";
import { Loader2, Pause, Play } from "lucide-react";
import { Agent, AGENTS } from "@/components/AgentSprite";

type ContentMode = "show" | "output";
const HLS_URL = "https://mdw-prod-catalyst-0.lp-playback.studio/hls/video+85c28sa2o8wppm58/1_0/index.m3u8?tkn=3158657102";
const clampInterval = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};
const PROMPT_INTERVAL_MS = clampInterval(Number(process.env.NEXT_PUBLIC_AGENT_PROMPT_INTERVAL_MS || 30_000), 30_000, 40_000);
const CONTROL_INTERVAL_MS = clampInterval(Number(process.env.NEXT_PUBLIC_AGENT_CONTROL_INTERVAL_MS || 10_000), 10_000, 20_000);
const REASONING_INTERVAL_MS = clampInterval(Number(process.env.NEXT_PUBLIC_AGENT_REASONING_INTERVAL_MS || 10_000), 10_000, 20_000);
const EFFECT_VIDEO_URLS = (process.env.NEXT_PUBLIC_EFFECT_VIDEO_URLS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const DEFAULT_EFFECT_NUMBERS = [6, 8, 9, 10, 11];
const EFFECT_VIDEOS = EFFECT_VIDEO_URLS.length
  ? EFFECT_VIDEO_URLS
  : DEFAULT_EFFECT_NUMBERS.map((num) => `/effect${num}.mp4`);
const EFFECT_COUNT = EFFECT_VIDEOS.length;
const randomEffect = () => Math.floor(Math.random() * EFFECT_COUNT) + 1;
const SCOPE_ENV = (process.env.NEXT_PUBLIC_SCOPE_ENV || "prod").toLowerCase();
const IS_LOCAL_SCOPE = SCOPE_ENV === "local";
const STARTUP_PIPELINES = IS_LOCAL_SCOPE
  ? ["longlive"]
  : [
      "kaleido-scope",
      "glitch-realm",
      "crystal-box",
      "morph-host",
      "urban-spray",
      "cosmic-drift",
    ];
const CAPTION_POST_PIPELINE_CANDIDATES = [
  "scope-wallspace-captions-post",
  "scope-wallspace-captions",
  "wallspace-captions-post",
  "wallspace-captions-pre",
  "wallspace-captions",
];

function resolveCaptionPostPipelineId(pipelines: Record<string, unknown>): string | null {
  for (const id of CAPTION_POST_PIPELINE_CANDIDATES) {
    if (pipelines?.[id]) return id;
  }
  return null;
}

function composePipelineChain(mainPipelineId: string, pipelines: Record<string, unknown>): string[] {
  const captionPost = resolveCaptionPostPipelineId(pipelines);
  if (captionPost && captionPost !== mainPipelineId) {
    return [mainPipelineId, captionPost];
  }
  return [mainPipelineId];
}

function captionManualDefaults(): Record<string, unknown> {
  return {
    text_source: "manual",
    prompt_enabled: false,
    overlay_enabled: true,
    position_preset: "center",
    text_align: "center",
    font_weight: "bold",
    font_size: 64,
    outline_enabled: true,
    outline_width: 3,
    outline_color_r: 0,
    outline_color_g: 0,
    outline_color_b: 0,
    text_color_r: 255,
    text_color_g: 230,
    text_color_b: 120,
  };
}

export default function AppPage() {
  const [settings, setSettings] = useState<ShowSettings>(() => loadSettings());
  const [contentMode, setContentMode] = useState<ContentMode>("show");
  const [activePanel, setActivePanel] = useState<ActiveControlPanel>(null);
  const showModeOutputVideoRef = useRef<HTMLVideoElement>(null);
  const outputModeOutputVideoRef = useRef<HTMLVideoElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const scopeStartInFlightRef = useRef(false);
  const scopeRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scopeStartWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const userOverrideRef = useRef<() => void>(() => {});
  const effectStreamRef = useRef<MediaStream | null>(null);
  const fileVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);
  const [inputSource, setInputSource] = useState<"hls" | "video_file" | "audio_file" | "external_audio">("hls");
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const shouldPauseEffects = isPlaybackPaused;

  const {
    isConnected,
    isConnecting,
    error: scopeError,
    startWebRTC,
    stopWebRTC,
    loadPipeline,
    pipelines,
    fetchPipelines,
    activePipeline,
    configSchema,
    isLoadingPipeline,
    sendParameterUpdate,
    installPlugin,
    configureNDI,
    remoteStream,
  } = useScopeSession();

  const [hasStartedStream, setHasStartedStream] = useState(false);

  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(AGENTS[0] || null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [currentMood, setCurrentMood] = useState<string>("neutral");
  const [currentParameters, setCurrentParameters] = useState<Record<string, unknown>>({});
  const [currentPlugins, setCurrentPlugins] = useState<string[]>([]);
  const [selectedEffect, setSelectedEffect] = useState<number>(1);
  const [isScopeConnected, setIsScopeConnected] = useState(false);
  const [hasEffectStreamReady, setHasEffectStreamReady] = useState(false);
  const [audioProvider] = useState<AudioMetricsProvider>(
    (process.env.NEXT_PUBLIC_AUDIO_METRICS_PROVIDER as AudioMetricsProvider) || "webaudio"
  );

  useEffect(() => {
    setSelectedEffect(randomEffect());
  }, []);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    [showModeOutputVideoRef.current, outputModeOutputVideoRef.current].forEach((videoEl) => {
      if (!videoEl) return;
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(console.error);
    });
  }, []);

  const { audioStream, initAudio } = useAudioExtractor({
    hlsUrl: inputSource === "hls" ? HLS_URL : undefined,
    videoElement: inputSource === "video_file" && fileVideoRef.current ? fileVideoRef.current : undefined,
  });

  useEffect(() => {
    if (inputSource === "hls" && audioStream) {
      audioStreamRef.current = audioStream;
    }
  }, [audioStream, inputSource]);

  useEffect(() => {
    if ((audioProvider === "webaudio" || audioProvider === "hybrid") && inputSource === "hls") {
      initAudio();
    }
  }, [audioProvider, initAudio, inputSource]);

  const { metrics: audioMetrics, health: audioHealth } = useAudioReactive({
    enabled: isStreaming && (!!audioStreamRef.current || audioProvider !== "webaudio"),
    sourceStream: audioStreamRef.current,
    provider: audioProvider,
    updateIntervalMs: 750,
  });

  const { activeAgent, activeSlot, nextTransitionAt } = useAgentSchedule({
    enabled: isStreaming,
  });

  const { muteAll, setAudioEnabled } = useAudioPlayer();

  useEffect(() => {
    setAudioEnabled(true);
  }, [setAudioEnabled]);

  useEffect(() => {
    return () => {
      muteAll();
    };
  }, [muteAll]);

  const handlePipelineChange = useCallback((pipelineId: string) => {
    userOverrideRef.current();
    setSelectedPipeline(pipelineId);
  }, []);

  const handleLoadPipeline = useCallback(() => {
    if (selectedPipeline) {
      userOverrideRef.current();
      const chain = composePipelineChain(selectedPipeline, pipelines as Record<string, unknown>);
      loadPipeline(chain, { input_mode: "video" }).then(() => {
        sendParameterUpdate(captionManualDefaults());
      });
    }
  }, [selectedPipeline, loadPipeline, pipelines, sendParameterUpdate]);

  const handleParamChange = useCallback((key: string, value: any) => {
    userOverrideRef.current();
    setCurrentParameters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const connectToScope = useCallback(async () => {
    if (scopeStartInFlightRef.current) {
      return;
    }

    // Don't reset if already streaming - just keep the existing stream
    const wasAlreadyStreaming = hasStartedStream;
    
    scopeStartInFlightRef.current = true;
    setIsScopeConnected(false);
    if (!wasAlreadyStreaming) {
      setHasStartedStream(false);
    }

    try {
      if (scopeStartWatchdogRef.current) {
        clearTimeout(scopeStartWatchdogRef.current);
        scopeStartWatchdogRef.current = null;
      }

      const availableStartupPipelines = STARTUP_PIPELINES.filter((id) => Boolean(pipelines?.[id]));
      const startupPipeline =
        availableStartupPipelines[Math.floor(Math.random() * Math.max(1, availableStartupPipelines.length))] ||
        "kaleido-scope";

      const pipelineChain = composePipelineChain(startupPipeline, pipelines as Record<string, unknown>);
      const initialParameters: Record<string, unknown> = {
        input_mode: "video",
        pipeline_ids: pipelineChain,
        ...captionManualDefaults(),
      };

      await loadPipeline(pipelineChain, { input_mode: "video" });
      setSelectedPipeline(startupPipeline);

      if (!effectStreamRef.current) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 10000);
          const checkInterval = setInterval(() => {
            if (effectStreamRef.current) {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      if (!effectStreamRef.current) {
        showError("Effect video not ready", "Please try again");
        return;
      }

      await startWebRTC(
        (remoteStream) => {
          attachRemoteStream(remoteStream);
          if (scopeStartWatchdogRef.current) {
            clearTimeout(scopeStartWatchdogRef.current);
            scopeStartWatchdogRef.current = null;
          }
          setIsScopeConnected(true);
          setHasStartedStream(true);
        },
        initialParameters,
        effectStreamRef.current
      );

      scopeStartWatchdogRef.current = setTimeout(() => {
        if (!remoteStream) {
          setIsScopeConnected(false);
          stopWebRTC();
        }
      }, 35000) as unknown as NodeJS.Timeout;
    } catch (error) {
      console.error("Scope connection error:", error);
      setIsScopeConnected(false);
    } finally {
      scopeStartInFlightRef.current = false;
    }
  }, [loadPipeline, startWebRTC, remoteStream, stopWebRTC, attachRemoteStream, pipelines]);

  const handleInputSourceChange = useCallback((source: "hls" | "video_file" | "audio_file" | "external_audio") => {
    userOverrideRef.current();
    setInputSource(source);
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream, connectToScope]);

  const handleInputStreamReady = useCallback((stream: MediaStream | null) => {
    audioStreamRef.current = stream;
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream, connectToScope]);

  const handleFileVideoReady = useCallback((stream: MediaStream | null, videoElement: HTMLVideoElement) => {
    fileVideoRef.current = videoElement;
    fileAudioRef.current = null;
    if (stream) {
      audioStreamRef.current = stream;
    }
    setInputSource("video_file");
    [showModeOutputVideoRef.current, outputModeOutputVideoRef.current].forEach((videoEl) => {
      if (!videoEl || !stream) return;
      videoEl.srcObject = stream;
      videoEl.play().catch(() => undefined);
    });
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream, connectToScope]);

  const handleAudioFileReady = useCallback((stream: MediaStream | null, audioElement: HTMLAudioElement) => {
    fileAudioRef.current = audioElement;
    fileVideoRef.current = null;
    audioStreamRef.current = stream;
    const source = (audioElement.dataset.inputSource as "audio_file" | "external_audio" | undefined) || "audio_file";
    setInputSource(source);
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream, connectToScope]);

  const togglePlaybackPause = useCallback(() => {
    userOverrideRef.current();
    const nextPaused = !isPlaybackPaused;
    setIsPlaybackPaused(nextPaused);

    const mediaTargets: Array<HTMLMediaElement | null> = [
      showModeOutputVideoRef.current,
      outputModeOutputVideoRef.current,
      fileVideoRef.current,
      fileAudioRef.current,
    ];

    mediaTargets.forEach((media) => {
      if (!media) return;
      media.muted = nextPaused;
      if (nextPaused) {
        media.pause();
      } else {
        media.play().catch(() => undefined);
      }
    });
  }, [isPlaybackPaused]);

  useEffect(() => {
    if (!isStreaming && isConnected && (selectedAgent || activeAgent)) {
      setIsStreaming(true);
      showInfo("Agentic stream control started");
    }
  }, [isStreaming, isConnected, selectedAgent, activeAgent]);

  const disconnectFromScope = useCallback(() => {
    stopWebRTC();
    setIsScopeConnected(false);
    setHasStartedStream(false);
    setIsStreaming(false);
  }, [stopWebRTC]);

  const startAgentControl = useCallback(() => {
    setIsStreaming(true);
    connectToScope();
  }, [connectToScope]);

  const stopAgentControl = useCallback(() => {
    setIsStreaming(false);
    disconnectFromScope();
  }, [disconnectFromScope]);

  const clearAgentLogs = useCallback(() => {
    setAgentLogs([]);
  }, []);

  const handleRetry = useCallback(() => {
    stopWebRTC();
    setTimeout(() => {
      connectToScope();
    }, 100);
  }, [stopWebRTC, connectToScope]);

  const scopeInterface = useMemo(() => ({
    sendParameter: (params: Record<string, unknown>) => {
      setCurrentParameters((prev) => ({ ...prev, ...params }));
      sendParameterUpdate(params);
    },
    loadPipeline: async (id: string) => {
      const chain = composePipelineChain(id, pipelines as Record<string, unknown>);
      await loadPipeline(chain, { input_mode: "video" });
      sendParameterUpdate(captionManualDefaults());
    },
    installPlugin: async (spec: string) => {
      await installPlugin(spec);
      setCurrentPlugins((prev) => (prev.includes(spec) ? prev : [...prev, spec]));
      showInfo(`Installed plugin: ${spec}`);
    },
    configureNDI: async (enabled: boolean, name: string) => {
      await configureNDI(enabled, name);
      showInfo(`${enabled ? "Enabled" : "Disabled"} NDI: ${name}`);
    },
    getCurrentPipeline: () => activePipeline || selectedPipeline || "passthrough",
    getCurrentParameters: () => currentParameters,
    getCurrentPlugins: () => currentPlugins,
  }), [sendParameterUpdate, loadPipeline, installPlugin, configureNDI, activePipeline, selectedPipeline, currentParameters, currentPlugins, pipelines]);

  const handleAgentLog = useCallback((log: AgentLog) => {
    setAgentLogs((prev) => [log, ...prev].slice(0, 100));
  }, []);

  const handleMoodChange = useCallback((mood: string) => {
    setCurrentMood(mood);
  }, []);

  const handleEffectChange = useCallback((effect: number) => {
    setSelectedEffect(effect);
  }, []);

  useEffect(() => {
    if (!activeAgent) return;
    setSelectedAgent((prev) => {
      if (prev?.slug === activeAgent.slug) return prev;
      setAgentLogs((logs) => [
        {
          id: `${Date.now()}-schedule-${activeAgent.slug}`,
          timestamp: new Date(),
          agent: activeAgent.name,
          type: "system" as const,
          content: `Scheduled handoff: ${activeAgent.name} is now live (${activeSlot?.label || "current slot"})`,
        },
        ...logs,
      ].slice(0, 100));
      return activeAgent;
    });
  }, [activeAgent, activeSlot?.label]);

  const reasoningContext = useMemo(() => ({
    schedule: {
      slot: activeSlot?.label || "unscheduled",
      nextTransitionAt: nextTransitionAt?.toISOString() || null,
    },
    analyzer: {
      provider: audioProvider,
      source: inputSource,
    },
    pipelines: Object.entries(pipelines || {}).map(([id, info]) => {
      const schema = (info as any)?.config_schema || {};
      const schemaRoot = schema?.properties && typeof schema.properties === "object" ? schema.properties : schema;
      const controls = Object.entries(schemaRoot || {}).map(([key, field]: [string, any]) => ({
        key,
        type: field?.type || "any",
        description: field?.description || "",
        enum: Array.isArray(field?.enum) ? field.enum : undefined,
        min: typeof field?.minimum === "number" ? field.minimum : typeof field?.ge === "number" ? field.ge : undefined,
        max: typeof field?.maximum === "number" ? field.maximum : typeof field?.le === "number" ? field.le : undefined,
      }));
      return {
        id,
        name: (info as any)?.pipeline_name || (info as any)?.name || id,
        description: (info as any)?.pipeline_description || (info as any)?.description || "",
        controls,
      };
    }),
  }), [activeSlot?.label, nextTransitionAt, audioProvider, inputSource, pipelines]);

  const activeBrainAgent = selectedAgent || activeAgent;

  const {
    userOverride,
    handleUserOverride,
    resumeAgent,
    runtimeMetrics,
  } = useAgentBrain({
    agent: activeBrainAgent || AGENTS[0],
    audioStream: audioStreamRef.current,
    audioMetricsOverride: audioMetrics,
    reasoningContext,
    isActive: isStreaming && !!activeBrainAgent && isScopeConnected,
    scope: scopeInterface,
    onLog: handleAgentLog,
    onMoodChange: handleMoodChange,
    onEffectChange: handleEffectChange,
    currentEffect: selectedEffect,
    effectCount: EFFECT_COUNT,
    reasoningInterval: REASONING_INTERVAL_MS,
    promptIntervalMs: PROMPT_INTERVAL_MS,
    controlIntervalMs: CONTROL_INTERVAL_MS,
    overrideCooldownMs: 1500,
  });

  useEffect(() => {
    userOverrideRef.current = handleUserOverride;
  }, [handleUserOverride]);

  const handleEffectStreamReady = useCallback((stream: MediaStream) => {
    effectStreamRef.current = stream;
    setHasEffectStreamReady(true);
  }, []);

  useEffect(() => {
    // Autostart Scope stream as soon as effect video stream is ready.
    if (!hasEffectStreamReady) return;
    if (hasStartedStream || scopeStartInFlightRef.current) return;
    connectToScope();
  }, [hasEffectStreamReady, hasStartedStream, connectToScope]);

  const handleAgentSelect = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, agent: agent.name };
    });
    setAgentLogs((logs) => [
      {
        id: `${Date.now()}-manual-agent-${agent.slug}`,
        timestamp: new Date(),
        agent: agent.name,
        type: "system" as const,
        content: `Manual agent select: ${agent.name} is now active`,
      },
      ...logs,
    ].slice(0, 100));
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    if (!hasStartedStream && !scopeStartInFlightRef.current) {
      connectToScope();
    }
  }, [isConnected, hasStartedStream]);

  useEffect(() => {
    if (!isStreaming) {
      setIsStreaming(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (remoteStream) {
      attachRemoteStream(remoteStream);
      setIsScopeConnected(true);
      setHasStartedStream(true);
    }
  }, [remoteStream, attachRemoteStream]);

  useEffect(() => {
    if (!isStreaming || !isConnected || remoteStream) {
      if (scopeRetryTimerRef.current) {
        clearTimeout(scopeRetryTimerRef.current);
        scopeRetryTimerRef.current = null;
      }
      return;
    }

    scopeRetryTimerRef.current = setTimeout(() => {
      connectToScope();
    }, 15000) as unknown as NodeJS.Timeout;

    return () => {
      if (scopeRetryTimerRef.current) {
        clearTimeout(scopeRetryTimerRef.current);
        scopeRetryTimerRef.current = null;
      }
    };
  }, [isStreaming, isConnected, remoteStream, connectToScope]);

  useEffect(() => {
    return () => {
      if (scopeRetryTimerRef.current) {
        clearTimeout(scopeRetryTimerRef.current);
      }
      if (scopeStartWatchdogRef.current) {
        clearTimeout(scopeStartWatchdogRef.current);
      }
      if (hasStartedStream) {
        stopWebRTC();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      document.querySelectorAll("video, audio").forEach((media) => {
        const element = media as HTMLMediaElement;
        element.muted = true;
        element.pause();
      });
      muteAll();
    };
  }, [hasStartedStream, stopWebRTC, muteAll]);

  useEffect(() => {
    const mutePageAudio = () => {
      document.querySelectorAll("video, audio").forEach((media) => {
        const element = media as HTMLMediaElement;
        element.muted = true;
        element.pause();
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        mutePageAudio();
      }
    };

    window.addEventListener("pagehide", mutePageAudio);
    window.addEventListener("beforeunload", mutePageAudio);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", mutePageAudio);
      window.removeEventListener("beforeunload", mutePageAudio);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    if (!configSchema) return;
    setCurrentParameters((prev) => {
      const next = { ...prev };
      for (const [key, field] of Object.entries(configSchema)) {
        if (next[key] === undefined && field && typeof field === "object" && "default" in field) {
          next[key] = (field as { default?: unknown }).default;
        }
      }
      return next;
    });
  }, [configSchema]);

  useEffect(() => {
    if (!settings?.agent) return;
    const matched = AGENTS.find((agent) => agent.name === settings.agent) || null;
    if (matched) {
      setSelectedAgent(matched);
    }
  }, [settings?.agent]);

  const drawerPanel = activePanel;
  const pipelineOptions = Object.fromEntries(
    Object.entries(pipelines || {}).map(([id, info]) => [
      id,
      {
        name: (info as { pipeline_name?: string }).pipeline_name || id,
        description: (info as { pipeline_description?: string }).pipeline_description,
      },
    ]),
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      <MiniHeader
        user={null}
        mode={contentMode}
        onModeChange={setContentMode}
      />

      <div className="flex-1 flex pt-16 min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div className={`relative flex-1 overflow-hidden ${contentMode === "show" ? "block" : "hidden"}`}>
            <div className="absolute inset-0 z-0">
              <ShowDisplay />
            </div>

            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-transparent to-black/35 pointer-events-none" />

            <div className="absolute bottom-32 inset-x-0 z-20 px-6">
              <div className="mx-auto w-[min(980px,92vw)] space-y-3">
                <div className="grid w-full gap-3 md:grid-cols-2">
                  <div className="relative h-[350px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                    <video
                      ref={showModeOutputVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-contain"
                    />
                    {!hasStartedStream && !scopeError && (isStreaming || isConnecting || isLoadingPipeline) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-center">
                          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
                          <p className="text-xs uppercase tracking-[0.25em]">
                            {isLoadingPipeline ? "Loading Pipeline..." : "Connecting To Scope..."}
                          </p>
                        </div>
                      </div>
                    )}
                    {scopeError && !isConnecting && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                        <div className="h-10 w-10 rounded-full border-2 border-red-500/50 flex items-center justify-center">
                          <span className="text-red-500 text-lg">!</span>
                        </div>
                        <p className="text-xs uppercase tracking-[0.2em] text-red-500/70">Scope Server Unavailable</p>
                        <p className="text-[10px] text-white/40 max-w-[200px] text-center px-2">{scopeError}</p>
                        <button
                          onClick={handleRetry}
                          className="mt-1 px-3 py-1.5 border border-white/20 rounded-full text-[10px] uppercase tracking-wider hover:bg-white/10"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <div className="absolute left-3 top-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-white/70">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${hasStartedStream || isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}
                      />
                      {hasStartedStream ? "Live" : isConnecting ? "Connecting" : isConnected ? "Ready" : "Offline"}
                    </div>
                    <button
                      onClick={togglePlaybackPause}
                      className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70"
                      aria-label={isPlaybackPaused ? "Play stream" : "Pause stream"}
                      title={isPlaybackPaused ? "Play" : "Pause"}
                    >
                      {isPlaybackPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="h-[350px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(236,72,153,0.12)]">
                  {inputSource === "hls" && (
                    <HLSPlayer
                      src={HLS_URL}
                      muted={isPlaybackPaused || contentMode !== "show"}
                      unmute={!isPlaybackPaused && contentMode === "show"}
                      paused={isPlaybackPaused || contentMode !== "show"}
                      autoPlay
                      className="w-full h-full"
                    />
                    )}
                    {inputSource === "video_file" && (
                      <video
                        ref={fileVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    )}
                    {inputSource === "audio_file" && (
                      <AudioBarsPreview sourceElement={fileAudioRef.current} />
                    )}
                    {inputSource === "external_audio" && (
                      <AudioBarsPreview sourceElement={fileAudioRef.current} />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-md">
                  <SetControlHub
                    activePanel={activePanel}
                    onPanelChange={setActivePanel}
                    settings={settings}
                    isConnected={isConnected}
                    activePipeline={activePipeline || selectedPipeline}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`relative flex-1 overflow-hidden px-6 pb-8 pt-4 ${contentMode === "output" ? "block" : "hidden"}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(236,72,153,0.18),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_85%,rgba(168,85,247,0.22),transparent_62%)]" />
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

            <div className="relative mx-auto h-full w-full max-w-[1200px]">
              <div className="relative mx-auto h-[85vh] min-h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-black/85">
                <video
                  ref={outputModeOutputVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-contain"
                />
                {!hasStartedStream && !scopeError && (isStreaming || isConnecting || isLoadingPipeline) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin" />
                      <p className="text-xs uppercase tracking-[0.25em]">
                        {isLoadingPipeline ? "Loading Pipeline..." : "Connecting To Scope..."}
                      </p>
                    </div>
                  </div>
                )}
                {scopeError && !isConnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                    <div className="h-10 w-10 rounded-full border-2 border-red-500/50 flex items-center justify-center">
                      <span className="text-red-500 text-lg">!</span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-red-500/70">Scope Server Unavailable</p>
                    <p className="text-[10px] text-white/40 max-w-xs text-center px-2">{scopeError}</p>
                    <button
                      onClick={handleRetry}
                      className="mt-1 px-3 py-1.5 border border-white/20 rounded-full text-[10px] uppercase tracking-wider hover:bg-white/10"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="absolute left-4 top-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/70">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${hasStartedStream || isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}
                  />
                  {hasStartedStream ? "Live" : isConnecting ? "Connecting" : isConnected ? "Ready" : "Offline"}
                </div>
                <button
                  onClick={togglePlaybackPause}
                  className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70"
                  aria-label={isPlaybackPaused ? "Play stream" : "Pause stream"}
                  title={isPlaybackPaused ? "Play" : "Pause"}
                >
                  {isPlaybackPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <div className="absolute bottom-4 right-4 z-30 h-48 w-72 overflow-hidden rounded-lg border-2 border-white/30 bg-black shadow-xl">
                  {inputSource === "hls" && (
                    <HLSPlayer
                      src={HLS_URL}
                      muted={isPlaybackPaused || contentMode !== "output"}
                      unmute={!isPlaybackPaused && contentMode === "output"}
                      paused={isPlaybackPaused || contentMode !== "output"}
                      autoPlay
                      className="w-full h-full"
                    />
                  )}
                  {inputSource === "video_file" && (
                    <video
                      ref={(el) => { if (el && fileVideoRef.current !== el) fileVideoRef.current = el; }}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  )}
                  {inputSource === "audio_file" && (
                    <AudioBarsPreview sourceElement={fileAudioRef.current} compact />
                  )}
                  {inputSource === "external_audio" && (
                    <AudioBarsPreview sourceElement={fileAudioRef.current} compact />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={!!drawerPanel} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent onClose={() => setActivePanel(null)}>
          {drawerPanel && (
            <>
              <SheetHeader>
                <SheetTitle>{getPanelTitle(drawerPanel)}</SheetTitle>
              </SheetHeader>
              <ControlDrawerContent
                panel={drawerPanel}
                settings={settings}
                onSettingsChange={setSettings}
                isConnected={isConnected}
                isConnecting={isConnecting}
                onConnect={startAgentControl}
                onDisconnect={stopAgentControl}
                pipelines={pipelineOptions}
                activePipeline={activePipeline || selectedPipeline}
                onPipelineChange={handlePipelineChange}
                onLoadPipeline={handleLoadPipeline}
                isLoadingPipeline={isLoadingPipeline}
                configSchema={configSchema}
                onParamChange={handleParamChange}
                sendParameterUpdate={sendParameterUpdate}
                currentParameters={currentParameters}
                onStreamReady={handleInputStreamReady}
                onFileStreamReady={handleFileVideoReady}
                onAudioFileReady={handleAudioFileReady}
                onInputSourceChange={handleInputSourceChange}
                agentLogs={agentLogs}
                agent={activeBrainAgent}
                onClearLogs={clearAgentLogs}
                onResumeAgent={resumeAgent}
                userOverrideActive={userOverride.active}
                onUserOverride={handleUserOverride}
                agentRuntime={runtimeMetrics}
                agentAudioHealth={audioHealth as AudioReactiveHealth}
                activeAgent={activeBrainAgent}
                onAgentSelect={handleAgentSelect}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <EffectVideoPlayer
        effects={EFFECT_VIDEOS}
        activeEffect={selectedEffect}
        paused={shouldPauseEffects}
        onStreamReady={handleEffectStreamReady}
        width={576}
        height={320}
        fps={15}
      />

    </div>
  );
}

function AudioBarsPreview({
  sourceElement,
  compact = false,
}: {
  sourceElement: HTMLAudioElement | null;
  compact?: boolean;
}) {
  const [levels, setLevels] = useState<number[]>(() => new Array(compact ? 16 : 28).fill(0.2));

  useEffect(() => {
    if (!sourceElement) return;

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = compact ? 128 : 256;
    analyser.smoothingTimeConstant = 0.82;

    let node: MediaStreamAudioSourceNode | null = null;
    let rafId = 0;

    const connectAndRun = async () => {
      try {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const audioWithCapture = sourceElement as HTMLAudioElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const stream = (audioWithCapture.captureStream?.() || audioWithCapture.mozCaptureStream?.()) as MediaStream | undefined;
        if (!stream) return;
        node = ctx.createMediaStreamSource(stream);
        node.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const bars = compact ? 16 : 28;

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const chunk = Math.max(1, Math.floor(data.length / bars));
          const next = new Array(bars).fill(0).map((_, i) => {
            const start = i * chunk;
            const end = Math.min(data.length, start + chunk);
            let sum = 0;
            for (let j = start; j < end; j += 1) sum += data[j];
            const avg = end > start ? sum / (end - start) : 0;
            return 0.12 + (avg / 255) * 0.88;
          });
          setLevels(next);
          rafId = requestAnimationFrame(tick);
        };

        tick();
      } catch (err) {
        console.warn("Audio bars unavailable:", err);
      }
    };

    connectAndRun();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (node) {
        node.disconnect();
      }
      analyser.disconnect();
      void ctx.close();
    };
  }, [sourceElement, compact]);

  return (
    <div className="relative h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.22),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.22),transparent_55%),#060606] p-4">
      <div className="absolute left-3 top-3 text-[9px] uppercase tracking-[0.25em] text-white/70">Audio Input</div>
      <div className="flex h-full w-full items-end justify-center gap-1">
        {levels.map((level, idx) => (
          <div
            key={`${idx}-${compact ? "c" : "f"}`}
            className="w-1.5 rounded-t bg-gradient-to-t from-cyan-500/80 via-blue-400/90 to-fuchsia-400/90 transition-[height] duration-100 ease-linear"
            style={{ height: `${Math.max(8, Math.round(level * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}
