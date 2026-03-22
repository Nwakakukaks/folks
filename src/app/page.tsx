"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Anton, Space_Grotesk } from "next/font/google";
import { Loader2, ExternalLink, Joystick, Radio, Calendar, Info, ShoppingBag, ChevronDown } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import HLSPlayer from "@/components/HLSPlayer";
import EffectVideoPlayer from "@/components/EffectVideoPlayer";
import SkillDialog from "@/components/SkillDialog";
import AudioInitDialog from "@/components/AudioInitDialog";
import { supabase } from "@/lib/supabase";
import { useScopeServer } from "@/hooks/useScopeServer";
import { useAudioExtractor } from "@/hooks/useAudioExtractor";
import { useAudioReactive } from "@/hooks/useAudioReactive";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { AGENTS } from "@/components/AgentSprite";

const HLS_URL = "https://nyc-prod-catalyst-0.lp-playback.studio/hls/video+85c28sa2o8wppm58/1_0/index.m3u8?tkn=955409166";

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

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<{ email?: string; avatar_url?: string } | null>(null);
  const [hasStartedStream, setHasStartedStream] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(weeklySchedule[0]?.date ?? null);
  const [selectedEffect, setSelectedEffect] = useState(1);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [currentAgent, setCurrentAgent] = useState("Echo");
  const [currentMood, setCurrentMood] = useState("neutral");
  const effectStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const agentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { isConnected, isConnecting, error: connectionError, startWebRTC, stopWebRTC, loadPipeline, sendParameterUpdate, fetchPipelines } = useScopeServer();

  const { audioStream, initAudio, isReady: audioReady } = useAudioExtractor({
    hlsUrl: HLS_URL,
  });

  const { metrics: audioMetrics } = useAudioReactive({
    enabled: isAgentActive && !!audioStreamRef.current,
    sourceStream: audioStreamRef.current,
  });

  const [agentPrompt, setAgentPrompt] = useState("vibrant abstract visuals with dynamic colors");
  const [showAudioInitDialog, setShowAudioInitDialog] = useState(true);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [selectedAgentForSkill, setSelectedAgentForSkill] = useState("");

  const { setAudioEnabled, muteAll } = useAudioPlayer();

  const handleEnableAudio = () => {
    console.log("[Home] handleEnableAudio called");
    setAudioEnabled(true);
    setShowAudioInitDialog(false);
  };

  const callAgentReasoning = useCallback(async () => {
    if (!audioStreamRef.current || !isAgentActive) {
      console.log("[Agent] Skipping reasoning - audioStream:", !!audioStreamRef.current, "isActive:", isAgentActive);
      return;
    }

    const agentName = currentAgent.toLowerCase();
    console.log(`[Agent] ${agentName} reasoning cycle starting...`);
    console.log(`[Agent] Audio metrics:`, JSON.stringify(audioMetrics, null, 2));

    try {
      console.log("[Agent] Sending reasoning request to /api/agents/reason");
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
            pipeline: "longlive",
            parameters: {},
            plugins: [],
            mood: "neutral",
            current_effect: selectedEffect,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Agent] Reasoning failed: ${response.status} - ${errorText}`);
        return;
      }

      const result = await response.json();
      console.log("[Agent] Reasoning response:", JSON.stringify(result, null, 2));

      if (result.mood) {
        console.log(`[Agent] Mood changed to: ${result.mood}`);
        setCurrentMood(result.mood);
      }

      if (result.actions) {
        console.log(`[Agent] Processing ${result.actions.length} actions`);
        for (const action of result.actions) {
          if (action.type === "send_prompt" && action.prompt) {
            console.log(`[Agent] Action: send_prompt - "${action.prompt.substring(0, 50)}..."`);
            setAgentPrompt(action.prompt);
            console.log("[Scope] Sending prompt to server...");
            sendParameterUpdate({
              prompts: [{ text: action.prompt, weight: 1.0 }],
            });
          } else if (action.type === "select_effect" && action.effect_number) {
            console.log(`[Agent] Action: select_effect - effect ${action.effect_number}`);
            setSelectedEffect(action.effect_number);
          } else {
            console.log(`[Agent] Action: ${action.type}`, action);
          }
        }
      }
      console.log(`[Agent] ${agentName} reasoning cycle complete`);
    } catch (err) {
      console.error(`[Agent] Reasoning error:`, err);
    }
  }, [currentAgent, audioMetrics, selectedEffect, isAgentActive, sendParameterUpdate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (currentUser) {
        setUser({
          email: currentUser.email,
          avatar_url: currentUser.user_metadata?.avatar_url,
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          avatar_url: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    return () => {
      stopWebRTC();
      muteAll();
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [stopWebRTC, muteAll]);

  useEffect(() => {
    if (audioStream) {
      audioStreamRef.current = audioStream;
    }
  }, [audioStream]);

  useEffect(() => {
    if (audioReady && effectStreamRef.current && isConnected && !hasStartedStream) {
      setIsAgentActive(true);
      callAgentReasoning();
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
      agentIntervalRef.current = setInterval(callAgentReasoning, 10000);
    }
    return () => {
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
    };
  }, [audioReady, isConnected, hasStartedStream]);

  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleBookAgents = () => {
    if (user) {
      window.location.href = "/app";
    } else {
      setShowAuthModal(true);
    }
  };

  const startScopeSession = useCallback(
    async (stream: MediaStream) => {
      console.log("[Scope] Starting scope session...");
      setHasStartedStream(false);

      try {
        stopWebRTC();
        console.log("[Scope] WebRTC stopped");

        console.log("[Scope] Loading pipeline: longlive");
        await loadPipeline(["longlive"], { input_mode: "video" });
        console.log("[Scope] Pipeline loaded successfully");

        console.log("[Scope] Starting WebRTC connection...");
        await startWebRTC(
          (remoteStream) => {
            console.log("[Scope] Remote stream received");
            if (mainVideoRef.current) {
              mainVideoRef.current.srcObject = remoteStream;
              mainVideoRef.current.play().catch(console.error);
            }
            setHasStartedStream(true);
            console.log("[Scope] Session started successfully!");
          },
          {
            input_mode: "video",
            pipeline_ids: ["longlive"],
          },
          stream,
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Scope] Session failed:`, errorMessage);
        console.log("[Scope] Will retry in 40 seconds if not streaming...");
        setHasStartedStream(true);
      }
    },
    [loadPipeline, startWebRTC, stopWebRTC],
  );

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const retryConnection = () => {
      if (!hasStartedStream && effectStreamRef.current) {
        console.log("[Scope] Stream not started after timeout, retrying...");
        startScopeSession(effectStreamRef.current);
      }
    };

    console.log("[Scope] Starting 40s retry timer...");
    retryIntervalRef.current = setInterval(retryConnection, 40000);

    return () => {
      console.log("[Scope] Clearing retry timer");
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [isConnected, hasStartedStream, startScopeSession]);

  const handleHlsStreamReady = useCallback(
    async (stream: MediaStream | null) => {
      console.log("[HLS] Stream ready, video tracks:", stream?.getVideoTracks().length || 0);
      if (stream) {
        effectStreamRef.current = stream;
      }
    },
    [],
  );

  const handleEffectStreamReady = useCallback(
    async (stream: MediaStream | null) => {
      console.log("[EffectVideo] Stream ready");
      if (stream) {
        effectStreamRef.current = stream;
        console.log("[EffectVideo] Video tracks:", stream.getVideoTracks().length);
        console.log("[Audio] Initializing audio extraction...");
        initAudio();
        setIsAgentActive(true);
        console.log("[Agent] Starting agent reasoning...");
        callAgentReasoning();
        if (agentIntervalRef.current) {
          clearInterval(agentIntervalRef.current);
        }
        console.log("[Agent] Setting up reasoning interval (10s)");
        agentIntervalRef.current = setInterval(callAgentReasoning, 10000);
        console.log("[Scope] Starting scope session...");
        await startScopeSession(stream);
      }
    },
    [initAudio, callAgentReasoning, startScopeSession],
  );

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
            animation: scroll 20s linear infinite;
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
                <HLSPlayer src={HLS_URL} muted onStreamReady={handleHlsStreamReady} className="w-full h-full" />
              </div>
              <button
                onClick={handleBookAgents}
                className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white cursor-pointer hover:bg-white/20 transition-colors"
              >
                <Joystick className="h-4 w-4" />
                Book agent VJ
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
                  Stream live from your apartment, plug into your venue, or hire the VJ agents for performances. All
                  bookings go toward a donation that supports the Scope open-source project.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
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
                    className="flex items-center gap-2 border border-white/30 px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <Joystick className="w-3 h-3" />
                    Book The Agents
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
                        className="text-[10px] text-white/40 hover:text-white uppercase tracking-wider underline underline-offset-2"
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

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          window.location.href = "/app";
        }}
      />

      <EffectVideoPlayer
        activeEffect={selectedEffect}
        onStreamReady={handleEffectStreamReady}
       
      />

      <AudioInitDialog
        isOpen={showAudioInitDialog}
        onConfirm={handleEnableAudio}
      />

      <SkillDialog
        agent={selectedAgentForSkill}
        isOpen={showSkillDialog}
        onClose={() => setShowSkillDialog(false)}
      />
    </div>
  );
}
