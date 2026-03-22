"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import MiniHeader from "@/components/MiniHeader";
import EffectVideoPlayer from "@/components/EffectVideoPlayer";
import ShowDisplay from "@/components/ShowDisplay";
import AuthModal from "@/components/AuthModal";
import OnboardingModal, { ShowSettings, loadSettings } from "@/components/OnboardingModal";
import SetControlHub, { ActiveControlPanel } from "@/components/SetControlHub";
import ControlDrawerContent, { getPanelTitle } from "@/components/ControlDrawerContent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import HLSPlayer from "@/components/HLSPlayer";
import { useScopeSession } from "@/context/ScopeSessionContext";
import { useAgentBrain, AgentLog } from "@/hooks/useAgentBrain";
import { useAudioExtractor } from "@/hooks/useAudioExtractor";
import { useAudioReactive } from "@/hooks/useAudioReactive";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { supabase } from "@/lib/supabase";
import { showError, showInfo } from "@/lib/toast";
import { Loader2, Play } from "lucide-react";
import { Agent, AGENTS } from "@/components/AgentSprite";

type ContentMode = "show" | "output";
const HLS_URL = "https://mdw-prod-catalyst-0.lp-playback.studio/hls/video+85c28sa2o8wppm58/1_0/index.m3u8?tkn=3158657102";

export default function AppPage() {
  const [user, setUser] = useState<{ email?: string; avatar_url?: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ShowSettings | null>(null);
  const [contentMode, setContentMode] = useState<ContentMode>("show");
  const [activePanel, setActivePanel] = useState<ActiveControlPanel>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const outputMainVideoRef = useRef<HTMLVideoElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const agentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scopeStartInFlightRef = useRef(false);
  const scopeRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scopeStartWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const effectStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const fileVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const [inputSource, setInputSource] = useState<'webcam' | 'file' | 'hls'>('hls');
  const isMountedRef = useRef(false);

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
    remoteStream,
  } = useScopeSession();

  const [hasStartedStream, setHasStartedStream] = useState(false);

  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [currentMood, setCurrentMood] = useState<string>("neutral");
  const [selectedEffect, setSelectedEffect] = useState(1);
  const [isScopeConnected, setIsScopeConnected] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("vibrant abstract visuals with dynamic colors");
  const [lastAgentReason, setLastAgentReason] = useState<string>("");

  const { audioStream, initAudio, isReady: audioReady } = useAudioExtractor({
    hlsUrl: inputSource === 'hls' ? HLS_URL : undefined,
    micStream: inputSource === 'webcam' ? webcamStreamRef.current : null,
    videoElement: inputSource === 'file' && fileVideoRef.current ? fileVideoRef.current : undefined,
  });

  useEffect(() => {
    if (audioStream) {
      audioStreamRef.current = audioStream;
    }
  }, [audioStream]);

  const { metrics: audioMetrics } = useAudioReactive({
    enabled: isStreaming && !!audioStreamRef.current,
    sourceStream: audioStreamRef.current,
  });

  const { muteAll } = useAudioPlayer();

  useEffect(() => {
    muteAll();
  }, [contentMode, muteAll]);

  useEffect(() => {
    return () => {
      muteAll();
    };
  }, [muteAll]);

  const handlePipelineChange = useCallback((pipelineId: string) => {
    setSelectedPipeline(pipelineId);
  }, []);

  const handleLoadPipeline = useCallback(() => {
    if (selectedPipeline) {
      loadPipeline([selectedPipeline]);
    }
  }, [selectedPipeline, loadPipeline]);

  const handleParamChange = useCallback((key: string, value: any) => {
    sendParameterUpdate({ [key]: value });
  }, [sendParameterUpdate]);

  const validatePrerequisites = useCallback((): boolean => {
    if (!user) {
      showError("Please log in to start the agent");
      return false;
    }
    if (!selectedAgent) {
      showError("Please select an agent before starting");
      return false;
    }
    if (!isConnected) {
      showError("Please connect to Scope server first");
      return false;
    }
    if (!process.env.NEXT_PUBLIC_GROQ_API_KEY) {
      showError("Groq API key not configured");
      return false;
    }
    if (!audioStreamRef.current) {
      showError("No audio source available");
      return false;
    }
    return true;
  }, [user, selectedAgent, isConnected]);

  const callAgentReasoning = useCallback(async () => {
    if (!audioStreamRef.current || !isStreaming || !selectedAgent) return;

    const agentName = selectedAgent.name.toLowerCase();

    try {
      const response = await fetch("/api/agents/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agentName,
          skill: "",
          audio_metrics: audioMetrics || {
            overall: 0.5,
            beatDetected: false,
            tempo: 0,
            mood: "calm",
            dominantRange: "mids",
          },
          current_state: {
            pipeline: "passthrough",
            parameters: {},
            plugins: [],
            mood: currentMood,
            current_effect: selectedEffect,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Agent] Reasoning failed: ${response.status} - ${errorText}`);

        if (response.status === 429) {
          const retryMatch = errorText.match(/try again in ([\d.]+)s/);
          const retryDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : 2000;
          console.log(`[Agent] Rate limited, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return callAgentReasoning();
        }
        return;
      }

      const result = await response.json();

      if (result.thinking) {
        setLastAgentReason(result.thinking.substring(0, 100) + "...");
        setAgentLogs(prev => [{
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          agent: selectedAgent.name,
          type: "thinking" as const,
          content: result.thinking,
        }, ...prev].slice(0, 100));
      }

      if (result.mood !== currentMood) {
        setCurrentMood(result.mood);
      }

      if (result.actions) {
        for (const action of result.actions) {
          if (action.type === "send_prompt" && action.prompt) {
            setAgentPrompt(action.prompt);
            sendParameterUpdate({
              transition: {
                target_prompts: [{ text: action.prompt, weight: 1.0 }],
                num_steps: 8
              }
            });
            setAgentLogs(prev => [{
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
              agent: selectedAgent.name,
              type: "action" as const,
              content: `Injecting prompt: "${action.prompt.substring(0, 50)}..."`,
            }, ...prev].slice(0, 100));
          } else if (action.type === "select_effect" && action.effect_number) {
            setSelectedEffect(action.effect_number);
            setAgentLogs(prev => [{
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
              agent: selectedAgent.name,
              type: "action" as const,
              content: `Switching to effect ${action.effect_number}`,
            }, ...prev].slice(0, 100));
          }
        }
      }
    } catch (err) {
      console.error("Agent reasoning error:", err);
    }
  }, [selectedAgent, audioMetrics, currentMood, selectedEffect, isStreaming, sendParameterUpdate]);

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

      const initialParameters: Record<string, unknown> = {
        input_mode: "video",
        pipeline_ids: ["kaleido-scope"],
        prompts: [{ text: agentPrompt, weight: 1.0 }],
      };

      await loadPipeline(["kaleido-scope"], { input_mode: "video" });

      if (!effectStreamRef.current) {
        console.log("[Scope] Waiting for effect video stream...");
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
          console.log("[Scope] Remote stream received");
          if (outputVideoRef.current) {
            outputVideoRef.current.srcObject = remoteStream;
            outputVideoRef.current.play().catch(console.error);
          }
          if (outputMainVideoRef.current) {
            outputMainVideoRef.current.srcObject = remoteStream;
            outputMainVideoRef.current.play().catch(console.error);
          }
          if (scopeStartWatchdogRef.current) {
            clearTimeout(scopeStartWatchdogRef.current);
            scopeStartWatchdogRef.current = null;
          }
          setIsScopeConnected(true);
          setHasStartedStream(true);
          console.log("[Scope] Session started successfully!");
        },
        initialParameters,
        effectStreamRef.current
      );

      scopeStartWatchdogRef.current = setTimeout(() => {
        if (!remoteStream) {
          console.warn("[Scope] App stream watchdog triggered, scheduling retry...");
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
  }, [loadPipeline, startWebRTC, agentPrompt, remoteStream, stopWebRTC]);

  const handleStreamToggle = useCallback(() => {
    if (isStreaming) {
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
        agentIntervalRef.current = null;
      }
      if (scopeRetryTimerRef.current) {
        clearTimeout(scopeRetryTimerRef.current);
        scopeRetryTimerRef.current = null;
      }
      if (scopeStartWatchdogRef.current) {
        clearTimeout(scopeStartWatchdogRef.current);
        scopeStartWatchdogRef.current = null;
      }
      stopWebRTC();
      setIsScopeConnected(false);
      setIsStreaming(false);
      showInfo("Agent stopped");
    } else {
      if (validatePrerequisites()) {
        setIsStreaming(true);
        showInfo(`Starting ${selectedAgent?.name}...`);
        connectToScope();
        callAgentReasoning();
        agentIntervalRef.current = setInterval(callAgentReasoning, 30000);
      }
    }
  }, [isStreaming, validatePrerequisites, selectedAgent, callAgentReasoning, stopWebRTC, connectToScope]);

  const handleInputSourceChange = useCallback((source: "webcam" | "file" | "hls") => {
    setInputSource(source);
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream]);

  const handleInputStreamReady = useCallback((stream: MediaStream | null) => {
    webcamStreamRef.current = stream;
    setInputSource('webcam');
    // Create a video element to display the stream
    if (stream && webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = stream;
    }
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream]);

  const handleFileVideoReady = useCallback((stream: MediaStream | null, videoElement: HTMLVideoElement) => {
    fileVideoRef.current = videoElement;
    setInputSource('file');
    if (hasStartedStream) {
      connectToScope();
    }
  }, [hasStartedStream]);

  const disconnectFromScope = useCallback(() => {
    stopWebRTC();
    setIsScopeConnected(false);
    setHasStartedStream(false);
  }, [stopWebRTC]);

  const handleRetry = useCallback(() => {
    stopWebRTC();
    setTimeout(() => {
      connectToScope();
    }, 100);
  }, [stopWebRTC, connectToScope]);

  const scopeInterface = useMemo(() => ({
    sendParameter: (params: Record<string, unknown>) => {
      sendParameterUpdate(params);
    },
    loadPipeline: async (id: string) => {
      await loadPipeline([id]);
    },
    installPlugin: async (spec: string) => {
      showInfo(`Installing plugin: ${spec}`);
    },
    configureNDI: async (enabled: boolean, name: string) => {
      showInfo(`${enabled ? "Enabling" : "Disabling"} NDI: ${name}`);
    },
    getCurrentPipeline: () => activePipeline || selectedPipeline || "passthrough",
    getCurrentParameters: () => ({}),
    getCurrentPlugins: () => [],
  }), [sendParameterUpdate, loadPipeline, activePipeline, selectedPipeline]);

  const handleAgentLog = useCallback((log: AgentLog) => {
    setAgentLogs((prev) => [log, ...prev].slice(0, 100));
  }, []);

  const handleMoodChange = useCallback((mood: string) => {
    setCurrentMood(mood);
  }, []);

  const handleEffectChange = useCallback((effect: number) => {
    setSelectedEffect(effect);
  }, []);

  const handleEffectStreamReady = useCallback((stream: MediaStream) => {
    effectStreamRef.current = stream;
    console.log("[Effect] Stream ready:", stream.getVideoTracks().length, "video tracks");
  }, []);

  // Auto-start when connected to Scope (mirrors home page behavior)
  useEffect(() => {
    if (!isConnected) return;
    if (!hasStartedStream && !scopeStartInFlightRef.current) {
      console.log("[Scope] Connected and no stream yet, triggering connectToScope");
      connectToScope();
    }
  }, [isConnected, hasStartedStream]);

  useEffect(() => {
    if (outputVideoRef.current && remoteStream) {
      outputVideoRef.current.srcObject = remoteStream;
    }
    if (outputMainVideoRef.current && remoteStream) {
      outputMainVideoRef.current.srcObject = remoteStream;
    }
    if (remoteStream) {
      setIsScopeConnected(true);
      setHasStartedStream(true);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!isStreaming || !isConnected || remoteStream) {
      if (scopeRetryTimerRef.current) {
        clearTimeout(scopeRetryTimerRef.current);
        scopeRetryTimerRef.current = null;
      }
      return;
    }

    scopeRetryTimerRef.current = setTimeout(() => {
      console.log("[Scope] No output stream yet in app, retrying connection...");
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
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
        webcamStreamRef.current = null;
      }
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url,
        });
      } else {
        const isGuestUser = localStorage.getItem("aifolks_guest") === "true";
        if (isGuestUser) {
          setUser({ email: "guest@aifolks.local" });
        } else {
          setShowAuthModal(true);
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          avatar_url: session.user.user_metadata?.avatar_url,
        });
        setShowAuthModal(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !showAuthModal) {
      const savedSettings = loadSettings();
      if (savedSettings.completed) {
        setSettings(savedSettings);
      } else {
        setShowOnboarding(true);
      }
    }
  }, [user, showAuthModal]);

  const handleAuthSuccess = (isGuestMode?: boolean) => {
    if (isGuestMode) {
      setUser({ email: "guest@aifolks.local" });
    }
    setShowAuthModal(false);
  };

  const handleOnboardingComplete = (newSettings: ShowSettings) => {
    setSettings(newSettings);
    setShowOnboarding(false);
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
  };

  const handleSettingsUpdate = (newSettings: ShowSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

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
        user={user}
        mode={contentMode}
        onModeChange={setContentMode}
        onAuthClick={() => setShowAuthModal(true)}
      />

      <div className="flex-1 flex pt-16 min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {contentMode === "show" ? (
            <div className="relative flex-1 overflow-hidden">
              <div className="absolute inset-0 z-0">
                <ShowDisplay />
              </div>

              <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-transparent to-black/35 pointer-events-none" />

              <div className="absolute bottom-32 inset-x-0 z-20 px-6">
                <div className="mx-auto w-[min(980px,92vw)] space-y-3">
                  <div className="grid w-full gap-3 md:grid-cols-2">
                    <div className="relative h-[350px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                      <video
                        ref={outputMainVideoRef}
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
                    </div>
                    <div className="h-[350px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(236,72,153,0.12)]">
                      {inputSource === 'hls' && (
                        <HLSPlayer
                          src={HLS_URL}
                          muted
                          className="w-full h-full"
                        />
                      )}
                      {inputSource === 'webcam' && (
                        <video
                          ref={webcamVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}
                      {inputSource === 'file' && (
                        <video
                          ref={fileVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
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
          ) : (
            <div className="relative flex-1 overflow-hidden px-6 pb-8 pt-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(236,72,153,0.18),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_85%,rgba(168,85,247,0.22),transparent_62%)]" />
              <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

              <div className="relative mx-auto h-full w-full max-w-[1200px]">
                <div className="relative mx-auto h-[85vh] min-h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-black/85">
                  <video
                    ref={outputMainVideoRef}
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
                  {contentMode === "output" && (
                    <div className="absolute bottom-4 right-4 z-30 h-48 w-72 overflow-hidden rounded-lg border-2 border-white/30 bg-black shadow-xl">
                      {inputSource === 'hls' && (
                        <HLSPlayer
                          src={HLS_URL}
                          muted
                          className="w-full h-full"
                        />
                      )}
                      {inputSource === 'webcam' && (
                        <video
                          ref={(el) => { if (el && webcamVideoRef.current !== el) webcamVideoRef.current = el; }}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}
                      {inputSource === 'file' && (
                        <video
                          ref={(el) => { if (el && fileVideoRef.current !== el) fileVideoRef.current = el; }}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
                onConnect={() => { }}
                onDisconnect={disconnectFromScope}
                pipelines={pipelineOptions}
                activePipeline={activePipeline || selectedPipeline}
                onPipelineChange={handlePipelineChange}
                onLoadPipeline={handleLoadPipeline}
                isLoadingPipeline={isLoadingPipeline}
                configSchema={configSchema}
                onParamChange={handleParamChange}
                sendParameterUpdate={sendParameterUpdate}
                onStreamReady={handleInputStreamReady}
                onFileStreamReady={handleFileVideoReady}
                onInputSourceChange={handleInputSourceChange}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <EffectVideoPlayer
        activeEffect={selectedEffect}
        onStreamReady={handleEffectStreamReady}
        width={576}
        height={320}
        fps={15}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <OnboardingModal
        isOpen={showSettings}
        onClose={handleSettingsClose}
        onComplete={handleSettingsUpdate}
      />
    </div>
  );
}
