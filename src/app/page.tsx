"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Anton, Space_Grotesk } from "next/font/google";
import { Loader2, ExternalLink, Joystick, Radio, Calendar, Info, ShoppingBag, ChevronDown, Pause, Play } from "lucide-react";
import EffectVideoPlayer from "@/components/EffectVideoPlayer";
import HLSPlayer from "@/components/HLSPlayer";
import SkillDialog from "@/components/SkillDialog";
import AudioInitDialog from "@/components/AudioInitDialog";
import { useScopeServer } from "@/hooks/useScopeServer";
import { useAudioExtractor } from "@/hooks/useAudioExtractor";
import { AudioMetricsProvider, useAudioReactive } from "@/hooks/useAudioReactive";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { AGENTS } from "@/components/AgentSprite";
import { useAgentSchedule } from "@/hooks/useAgentSchedule";
import { useAgentBrain, AgentLog } from "@/hooks/useAgentBrain";

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

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-space",
  display: "swap",
});

const featuredAgents = ["Echo", "Vesper", "Riley", "Maya", "Luna"];

const showTemplate = [
  { time: "10AM - 11AM", title: "Morning Pulse", genre: "Techno, Ambient" },
  { time: "11AM - 12PM", title: "Noon Drift", genre: "Indie" },
  { time: "12PM - 1PM", title: "Acid Circuit", genre: "House, Acid" },
  { time: "1PM - 2PM", title: "Captured Echo", genre: "Indie, Shoegaze" },
  { time: "2PM - 3PM", title: "Bassline Window", genre: "Hip Hop, Leftfield" },
  { time: "3PM - 4PM", title: "Global Club Hour", genre: "Global, Club" },
  { time: "4PM - 5PM", title: "Breakbeat Assembly", genre: "Breaks, Beats" },
  { time: "5PM - 6PM", title: "Hardware Hour", genre: "Industrial, Live" },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ScheduleDay {
  day: string;
  date: string;
}

function generateScheduleDays(startDaysAhead: number = 0): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const today = new Date();
  
  for (let i = startDaysAhead; i < startDaysAhead + 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayName = DAYS_OF_WEEK[date.getDay()];
    const month = MONTHS[date.getMonth()];
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    
    days.push({
      day: dayName,
      date: `${month}.${dayOfMonth}.${year}`,
    });
  }
  
  return days;
}

const scheduleDays = generateScheduleDays(0);

const weeklySchedule = scheduleDays.map((day: ScheduleDay, dayIndex: number) => ({
  ...day,
  slots: showTemplate.map((slot, slotIndex) => ({
    ...slot,
    order: slotIndex + 1,
    agent: featuredAgents[(dayIndex + slotIndex) % featuredAgents.length],
  })),
}));

export default function Home() {
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  const [hasStartedStream, setHasStartedStream] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(weeklySchedule[0]?.date ?? null);
  const [selectedEffect, setSelectedEffect] = useState(1);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const [currentAgent, setCurrentAgent] = useState("Echo");
  const [currentMood, setCurrentMood] = useState("neutral");
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [currentParameters, setCurrentParameters] = useState<Record<string, unknown>>({});
  const [currentPlugins, setCurrentPlugins] = useState<string[]>([]);
  const [audioProvider] = useState<AudioMetricsProvider>(
    (process.env.NEXT_PUBLIC_AUDIO_METRICS_PROVIDER as AudioMetricsProvider) || "webaudio"
  );
  const [isStartingScope, setIsStartingScope] = useState(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isStartingScopeRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const startScopeSessionRef = useRef<() => void>(() => {});
  const effectStreamRef = useRef<MediaStream | null>(null);
  const userOverrideRef = useRef<() => void>(() => {});

  const {
    isConnected,
    isConnecting,
    error: connectionError,
    startWebRTC,
    stopWebRTC,
    loadPipeline,
    sendParameterUpdate,
    fetchPipelines,
    pipelines,
    activePipeline,
    installPlugin,
    configureNDI,
  } = useScopeServer();

  const { audioStream, initAudio, isReady: audioReady } = useAudioExtractor({
    hlsUrl: HLS_URL,
  });

  const { metrics: audioMetrics } = useAudioReactive({
    enabled: isAgentActive && (!!audioStreamRef.current || audioProvider !== "webaudio"),
    sourceStream: audioStreamRef.current,
    provider: audioProvider,
    updateIntervalMs: 750,
  });

  const [showAudioInitDialog, setShowAudioInitDialog] = useState(true);
  const [isUnmuted, setIsUnmuted] = useState(false);
  const [audioConsentGranted, setAudioConsentGranted] = useState(false);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [selectedAgentForSkill, setSelectedAgentForSkill] = useState("");

  useEffect(() => {
    setSelectedEffect(Math.floor(Math.random() * EFFECT_COUNT) + 1);
  }, []);

  const { setAudioEnabled, muteAll } = useAudioPlayer();
  const hasAnalyzedAudio =
    audioMetrics.isAnalyzing &&
    (audioMetrics.rms > 0.002 || audioMetrics.peak > 0.01 || audioMetrics.overall > 0.01);
  const shouldPauseEffects = isPlaybackPaused || !audioConsentGranted || !hasAnalyzedAudio;

  const { activeAgent } = useAgentSchedule({
    enabled: isAgentActive,
  });

  const handleEffectStreamReady = useCallback((stream: MediaStream) => {
    effectStreamRef.current = stream;
  }, []);

  const handleEnableAudio = () => {
    setAudioEnabled(true);
    setShowAudioInitDialog(false);
    setAudioConsentGranted(true);
    setIsPlaybackPaused(false);
    setIsUnmuted(true);
    initAudio();
    setIsAgentActive(true);
  };

  useEffect(() => {
    setAudioEnabled(false);
    setIsAgentActive(false);
  }, [setAudioEnabled]);

  const togglePlaybackPause = useCallback(() => {
    userOverrideRef.current();
    const nextPaused = !isPlaybackPaused;
    setIsPlaybackPaused(nextPaused);
    setIsUnmuted(!nextPaused);

    if (mainVideoRef.current) {
      mainVideoRef.current.muted = nextPaused;
      if (nextPaused) {
        mainVideoRef.current.pause();
      } else {
        mainVideoRef.current.play().catch(() => undefined);
      }
    }
  }, [isPlaybackPaused]);

  useEffect(() => {
    if (!activeAgent) return;
    setCurrentAgent(activeAgent.name);
  }, [activeAgent]);

  const handleAgentLog = useCallback((log: AgentLog) => {
    setAgentLogs((prev) => [log, ...prev].slice(0, 100));
  }, []);

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
    },
    configureNDI: async (enabled: boolean, name: string) => {
      await configureNDI(enabled, name);
    },
    getCurrentPipeline: () => activePipeline || "kaleido-scope",
    getCurrentParameters: () => currentParameters,
    getCurrentPlugins: () => currentPlugins,
  }), [sendParameterUpdate, loadPipeline, installPlugin, configureNDI, activePipeline, currentParameters, currentPlugins, pipelines]);

  const { handleUserOverride } = useAgentBrain({
    agent: activeAgent || AGENTS[0],
    audioStream: audioStreamRef.current,
    audioMetricsOverride: audioMetrics,
    isActive: isAgentActive && hasStartedStream,
    scope: scopeInterface,
    onLog: handleAgentLog,
    onMoodChange: setCurrentMood,
    onEffectChange: setSelectedEffect,
    currentEffect: selectedEffect,
    effectCount: EFFECT_COUNT,
    reasoningInterval: REASONING_INTERVAL_MS,
    promptIntervalMs: PROMPT_INTERVAL_MS,
    controlIntervalMs: CONTROL_INTERVAL_MS,
    overrideCooldownMs: 1500,
    reasoningContext: {
      analyzer: {
        provider: audioProvider,
        source: "hls",
      },
      pipelines: Object.entries(pipelines || {}).map(([id, info]) => {
        const pipeline = info as any;
        const schema = pipeline?.config_schema || {};
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
          name: pipeline?.pipeline_name || id,
          description: pipeline?.pipeline_description || "",
          controls,
        };
      }),
    },
  });

  useEffect(() => {
    userOverrideRef.current = handleUserOverride;
  }, [handleUserOverride]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    return () => {
      setIsUnmuted(false);
      setIsPlaybackPaused(true);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      document.querySelectorAll("video, audio").forEach((media) => {
        const element = media as HTMLMediaElement;
        element.muted = true;
        element.pause();
      });
      stopWebRTC();
      muteAll();
    
    };
  }, [stopWebRTC, muteAll]);

  useEffect(() => {
    const mutePageAudio = () => {
      setIsUnmuted(false);
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
    if (audioStream) {
      audioStreamRef.current = audioStream;
    }
  }, [audioStream]);

  const handleBookAgents = () => {
    window.location.href = "/app";
  };

  const scheduleRetry = useCallback((delayMs: number, reason: string) => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryTimeoutRef.current = setTimeout(() => {
      startScopeSessionRef.current();
    }, delayMs) as unknown as NodeJS.Timeout;
  }, []);

  const startScopeSession = useCallback(
    async () => {
      if (isStartingScopeRef.current) {
        return;
      }
      if (!audioConsentGranted || !hasAnalyzedAudio || isPlaybackPaused) {
        return;
      }

      isStartingScopeRef.current = true;
      setIsStartingScope(true);
      setHasStartedStream(false);

      try {
        if (startWatchdogRef.current) {
          clearTimeout(startWatchdogRef.current);
          startWatchdogRef.current = null;
        }

        stopWebRTC();

        const availableStartupPipelines = STARTUP_PIPELINES.filter((id) => Boolean(pipelines?.[id]));
        const startupPipeline =
          availableStartupPipelines[Math.floor(Math.random() * Math.max(1, availableStartupPipelines.length))] ||
          "kaleido-scope";
        const pipelineChain = composePipelineChain(startupPipeline, pipelines as Record<string, unknown>);
        await loadPipeline(pipelineChain, { input_mode: "video" });

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
          console.error("[Scope] Effect video not ready");
          isStartingScopeRef.current = false;
          setIsStartingScope(false);
          return;
        }

        await startWebRTC(
          (remoteStream) => {
            if (mainVideoRef.current) {
              mainVideoRef.current.srcObject = remoteStream;
              mainVideoRef.current.play().catch(console.error);
            }
            if (startWatchdogRef.current) {
              clearTimeout(startWatchdogRef.current);
              startWatchdogRef.current = null;
            }
            setHasStartedStream(true);
          },
          {
            input_mode: "video",
            pipeline_ids: pipelineChain,
            ...captionManualDefaults(),
          },
          effectStreamRef.current
        );


        startWatchdogRef.current = setTimeout(() => {
          if (!mainVideoRef.current?.srcObject) {
            setHasStartedStream(false);
            stopWebRTC();
            scheduleRetry(3000, "no remote frames");
          }
        }, 35000) as unknown as NodeJS.Timeout;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Scope] Session failed:`, errorMessage);
        setHasStartedStream(false);
        scheduleRetry(15000, "start failed");
      } finally {
        isStartingScopeRef.current = false;
        setIsStartingScope(false);
      }
    },
    [loadPipeline, scheduleRetry, startWebRTC, stopWebRTC, pipelines, audioConsentGranted, hasAnalyzedAudio, isPlaybackPaused],
  );

  useEffect(() => {
    startScopeSessionRef.current = () => {
      void startScopeSession();
    };
  }, [startScopeSession]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    if (!hasStartedStream && !isStartingScope && audioConsentGranted && hasAnalyzedAudio && !isPlaybackPaused) {
      startScopeSession();
    }
  }, [isConnected, hasStartedStream, isStartingScope, startScopeSession, audioConsentGranted, hasAnalyzedAudio, isPlaybackPaused]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (startWatchdogRef.current) {
        clearTimeout(startWatchdogRef.current);
      }
    };
  }, []);

  const toggleDay = (date: string) => {
    setExpandedDay((current) => (current === date ? null : date));
  };

  const openSkillDialog = (agent: string) => {
    setSelectedAgentForSkill(agent);
    setShowSkillDialog(true);
  };

  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#0f0f10] text-white`}>
      <div className="border-b border-white/10 bg-[#151515] overflow-hidden">
        <style jsx>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .scroll-text {
            animation: scroll 40s linear infinite;
          }
        `}</style>
        <div className="flex py-2">
          <div className="flex whitespace-nowrap scroll-text text-[11px] uppercase tracking-[0.35em] text-white/70">
            <span className="mx-8">Output stream is handled independently by agents running on Scope</span>
            <span className="mx-8">Input stream is exclusively the property of The Lot Radio and is only used for demonstration purposes</span>
            <span className="mx-8">Output stream is handled independently by agents running on Scope</span>
            <span className="mx-8">Input stream is exclusively the property of The Lot Radio and is only used for demonstration purposes</span>
          </div>
        </div>
      </div>

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-[0.3em] text-white/70 hover:text-white">
            THE AI FOLKS
          </Link>
          <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.3em] text-white/70">
            <Link href="/" className="flex items-center gap-2 hover:text-white">
              <Radio className="w-3 h-3" />
              Live
            </Link>
            <Link href="/events" className="flex items-center gap-2 hover:text-white">
              <Calendar className="w-3 h-3" />
              Events
            </Link>
            <Link href="/about" className="flex items-center gap-2 hover:text-white">
              <Info className="w-3 h-3" />
              About
            </Link>
            <Link href="/shop" className="flex items-center gap-2 hover:text-white">
              <ShoppingBag className="w-3 h-3" />
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_#2e2e2e,_#0f0f10_70%)]">
              <div className="aspect-[16/9] w-full relative">
                {!hasStartedStream && !connectionError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
                    <Loader2 className="h-12 w-12 animate-spin text-white/50" />
                    <p className="text-sm uppercase tracking-[0.2em] text-white/50">Connecting to Scope...</p>

                  </div>
                )}
                {connectionError && !isConnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 bg-black/80">
                    <div className="h-12 w-12 rounded-full border-2 border-red-500/50 flex items-center justify-center">
                      <span className="text-red-500 text-lg">!</span>
                    </div>
                    <p className="text-sm uppercase tracking-[0.2em] text-red-500/70">Scope Server Unavailable</p>
                    <p className="text-xs text-white/40 max-w-md text-center px-4">{connectionError}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-2 px-4 py-2 border border-white/20 rounded-full text-xs uppercase tracking-wider hover:bg-white/10"
                    >
                      Retry
                    </button>
                  </div>
                )}
                <video ref={mainVideoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
                <button
                  onClick={togglePlaybackPause}
                  className="absolute top-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70"
                  aria-label={isPlaybackPaused ? "Play stream" : "Pause stream"}
                  title={isPlaybackPaused ? "Play" : "Pause"}
                >
                  {isPlaybackPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
              </div>
              <div className="absolute left-6 top-6 flex flex-col gap-2 text-[11px] uppercase tracking-[0.35em] text-white/70">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${hasStartedStream || isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}
                  />
                  {hasStartedStream ? "Live" : isConnecting ? "Connecting" : isConnected ? "Ready" : "Offline"}
                </div>
                {isConnecting && (
                  <span className="text-[9px] text-white/30">Initializing WebRTC...</span>
                )}
              </div>
              <div className="absolute bottom-6 left-6 z-30 w-48 aspect-video rounded-lg overflow-hidden border-2 border-white/30 shadow-lg pointer-events-auto">
                <HLSPlayer src={HLS_URL} muted={isPlaybackPaused} paused={isPlaybackPaused} unmute={isUnmuted} className="w-full h-full" />
              </div>
              <button
                onClick={handleBookAgents}
                className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white cursor-pointer hover:bg-white/20 transition-colors"
              >
               
                Active agent - {currentAgent}
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-6 pb-14">
            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 className={`${anton.className} text-5xl uppercase tracking-tight`}>The AI Folks</h2>
                <p className="mt-4 text-sm uppercase tracking-[0.2em] text-white/60">
                  A 24/7 AI VJ show powered by Daydream Scope, the open-source creative playground for real-time video
                  transformation. Tune in anytime to watch the agents mix live visuals, or extend the show into your
                  own sets, streams, and events.
                </p>
                <p className="mt-4 text-sm uppercase tracking-[0.2em] text-white/60">
                  Stream live from your apartment, plug into your venue, or hire the VJ agents for performances. 
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm uppercase tracking-[0.3em] text-white/60">
                  <a
                    className="flex gap-2 items-center border border-white/30 px-4 py-2 hover:bg-white/5 transition-colors"
                    href="https://daydream.live/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    Daydream Scope
                  </a>
                  <button
                    onClick={handleBookAgents}
                    className="flex items-center gap-2 border text-sm uppercase border-yellow-400 px-4 py-2 hover:bg-white/5 transition-colors text-yellow-400"
                  >
                    <Joystick className="w-3 h-3" />
                    Get started
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#151515] p-6">
                <h3 className={`${anton.className} text-3xl uppercase`}>Featured Agents</h3>
                <div className="mt-6 grid gap-3 text-sm uppercase tracking-[0.2em] text-white/70">
                  {featuredAgents.map((agent) => (
                    <div key={agent} className="flex items-center gap-3 border-b border-white/10 pb-3 last:border-0">
                      <span className="h-2 w-2 rounded-full bg-yellow-400" />
                      <span className="flex-1">{agent}</span>
                      <button
                        onClick={() => openSkillDialog(agent)}
                        className="text-[10px] text-yellow-400 hover:text-white uppercase tracking-wider underline underline-offset-2"
                      >
                        View Skills
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="show-order" className="border-b border-white/10 bg-black">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4 ">
              <div>
                <h2 className={`${anton.className} text-6xl uppercase leading-none md:text-7xl`}>Calendar</h2>
              </div>
            </div>

            <div className="mt-10 grid gap-3">
              {weeklySchedule.map((day) => {
                const isOpen = expandedDay === day.date;

                return (
                  <div key={day.date} className="border border-white/10 bg-white/[0.02]">
                    <button
                      onClick={() => toggleDay(day.date)}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className={`${anton.className} text-3xl uppercase`}>{day.day}</span>
                      <span className={`${anton.className} text-3xl uppercase text-white/30`}>{day.date}</span>
                      <ChevronDown
                        className={`ml-auto h-5 w-5 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/10 px-4 py-4">
                        <div className="grid gap-4">
                          {day.slots.map((slot) => (
                            <div
                              key={`${day.date}-${slot.order}`}
                              className="grid gap-3 border-b border-white/10 pb-4 md:grid-cols-[72px_140px_1fr_180px_210px]"
                            >
                              <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                                {String(slot.order).padStart(2, "0")}
                              </div>
                              <div className="text-xs uppercase tracking-[0.25em] text-white/50">{slot.time}</div>
                              <div className="text-sm uppercase tracking-[0.2em] text-white/90">{slot.title}</div>
                              <div className="text-xs uppercase tracking-[0.2em] text-yellow-200/90">{slot.agent}</div>
                              <div className="text-xs uppercase tracking-[0.2em] text-white/40">{slot.genre}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#171717] text-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid gap-10 text-center md:grid-cols-2 md:text-left">
              <div>
                <h3 className={`${anton.className} text-4xl uppercase`}>How To Tune In?</h3>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-white/60">
                  Stream live 24/7 on web, mobile, and your favorite cast device.
                </p>
              </div>
              <div>
                <h3 className={`${anton.className} text-4xl uppercase`}>How To Support?</h3>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-white/60">
                  Become a supporter, grab merch, or donate to the Scope open-source project.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0f0f10]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs uppercase tracking-[0.3em] text-white/50 md:flex-row">
          <div>The AI Folks</div>
          <div>All Rights Reserved 2026</div>
        </div>
      </footer>

      <AudioInitDialog
        isOpen={showAudioInitDialog}
        onConfirm={handleEnableAudio}
        setUnmuted={setIsUnmuted}
      />

      <SkillDialog
        agent={selectedAgentForSkill}
        isOpen={showSkillDialog}
        onClose={() => setShowSkillDialog(false)}
      />

      <EffectVideoPlayer
        effects={EFFECT_VIDEOS}
        activeEffect={selectedEffect}
        enabled={audioConsentGranted && hasAnalyzedAudio}
        paused={shouldPauseEffects}
        onStreamReady={handleEffectStreamReady}
        width={576}
        height={320}
        fps={15}
      />
    </div>
  );
}
