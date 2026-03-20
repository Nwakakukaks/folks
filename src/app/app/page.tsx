"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MiniHeader from "@/components/MiniHeader";
import ShowDisplay from "@/components/ShowDisplay";
import AuthModal from "@/components/AuthModal";
import OnboardingModal, { ShowSettings, loadSettings } from "@/components/OnboardingModal";
import SetControlHub, { ActiveControlPanel } from "@/components/SetControlHub";
import ControlDrawerContent, { getPanelTitle } from "@/components/ControlDrawerContent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import HLSPlayer from "@/components/HLSPlayer";
import { useAutoVJController } from "@/hooks/useAutoVJController";
import { useScopeServer } from "@/hooks/useScopeServer";
import { supabase } from "@/lib/supabase";
import { Play } from "lucide-react";

type ContentMode = "show" | "output";
const HLS_URL = "https://nyc-prod-catalyst-0.lp-playback.studio/hls/video+85c28sa2o8wppm58/1_0/index.m3u8?tkn=955409166";

export default function AppPage() {
  const [user, setUser] = useState<{ email?: string; avatar_url?: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ShowSettings | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  const [contentMode, setContentMode] = useState<ContentMode>("show");
  const [activePanel, setActivePanel] = useState<ActiveControlPanel>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const outputMainVideoRef = useRef<HTMLVideoElement>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);

  const {
    isConnected,
    isConnecting,
    startWebRTC,
    stopWebRTC,
    loadPipeline,
    pipelines,
    fetchPipelines,
    activePipeline,
    configSchema,
    isLoadingPipeline,
    sendParameterUpdate,
  } = useScopeServer();

  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [inputSource, setInputSource] = useState<'webcam' | 'file' | 'hls'>('hls');

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

  const handleInputSourceChange = useCallback((source: 'webcam' | 'file' | 'hls') => {
    setInputSource(source);
  }, []);

  const handleStreamReady = useCallback((stream: MediaStream | null) => {
    setInputStream(stream);
  }, []);

  useAutoVJController({
    enabled: inputSource === "webcam" && !!inputStream && isConnected,
    sourceStream: inputStream,
    onControlFrame: sendParameterUpdate,
    fps: 8,
  });

  // connectToScope must be defined before handleInputStreamReady
  const connectToScope = useCallback(async (stream?: MediaStream | null) => {
    try {
      const initialParameters: Record<string, unknown> = {
        input_mode: settings?.inputType === "audio" ? "audio" : "video",
        pipeline_ids: ["passthrough"],
      };

      await loadPipeline(["passthrough"], { input_mode: settings?.inputType });

      await startWebRTC(
        (stream) => {
          setRemoteStream(stream);
        },
        initialParameters,
        stream ?? null
      );
    } catch (error) {
      console.error("Scope connection error:", error);
    }
  }, [settings?.inputType, loadPipeline, startWebRTC]);

  const disconnectFromScope = useCallback(() => {
    stopWebRTC();
    setRemoteStream(null);
  }, [stopWebRTC]);

  const handleInputStreamReady = useCallback(
    async (stream: MediaStream | null) => {
      if (!stream) return;
      
      setInputStream(stream);
      setInputSource('hls');

      if (inputStreamRef.current === stream) {
        return;
      }
      inputStreamRef.current = stream;

      if ((settings?.inputType ?? "video") !== "none") {
        await connectToScope(stream);
      }
    },
    [connectToScope, settings?.inputType],
  );

  // Fetch pipelines on mount
  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    if (outputVideoRef.current && remoteStream) {
      outputVideoRef.current.srcObject = remoteStream;
    }
    if (outputMainVideoRef.current && remoteStream) {
      outputMainVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle input stream changes - reconnect to Scope when source changes
  useEffect(() => {
    if (inputStream && isConnected) {
      // Small delay to allow cleanup of previous connection
      const timer = setTimeout(() => {
        disconnectFromScope();
        setTimeout(() => connectToScope(inputStream), 100);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [inputStream, inputSource]);

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
        if (savedSettings.inputType !== "none" && inputStream) {
          connectToScope(inputStream);
        }
      } else {
        setShowOnboarding(true);
      }
    }
  }, [user, showAuthModal, inputStream]);

  const handleAuthSuccess = (isGuestMode?: boolean) => {
    if (isGuestMode) {
      setUser({ email: "guest@aifolks.local" });
    }
    setShowAuthModal(false);
  };

  const handleOnboardingComplete = (newSettings: ShowSettings) => {
    setSettings(newSettings);
    setShowOnboarding(false);
    if (newSettings.inputType !== "none" && inputStream) {
      connectToScope(inputStream);
    }
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
                    <div className="h-[280px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                      {remoteStream ? (
                        <video
                          ref={outputVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/40">
                          <div className="text-center">
                            <Play className="mx-auto mb-3 h-10 w-10" />
                            <p className="text-xs uppercase tracking-[0.25em]">No Output Stream</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="h-[280px] overflow-hidden rounded-xl border border-gray-800 bg-black/55 shadow-[0_0_24px_rgba(236,72,153,0.12)]">
                      <HLSPlayer
                        src={HLS_URL}
                        onStreamReady={handleInputStreamReady}
                        className="h-full w-full"
                      />
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
                  {remoteStream ? (
                    <video
                      ref={outputMainVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/40">
                      <div className="text-center">
                        <Play className="mx-auto mb-3 h-10 w-10" />
                        <p className="text-xs uppercase tracking-[0.25em]">No Output Stream</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 right-4 z-30 h-48 w-72 overflow-hidden rounded-lg border-2 border-white/30 bg-black shadow-xl pointer-events-auto">
                    <HLSPlayer
                      src={HLS_URL}
                      onStreamReady={handleInputStreamReady}
                      className="h-full w-full"
                    />
                  </div>
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
                onConnect={connectToScope}
                onDisconnect={disconnectFromScope}
                pipelines={pipelineOptions}
                activePipeline={activePipeline || selectedPipeline}
                onPipelineChange={handlePipelineChange}
                onLoadPipeline={handleLoadPipeline}
                isLoadingPipeline={isLoadingPipeline}
                configSchema={configSchema}
                onParamChange={handleParamChange}
                sendParameterUpdate={sendParameterUpdate}
                onStreamReady={handleStreamReady}
                onInputSourceChange={handleInputSourceChange}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />

      <OnboardingModal
        isOpen={showSettings}
        onClose={handleSettingsClose}
        onComplete={handleSettingsUpdate}
      />
    </div>
  );
}
