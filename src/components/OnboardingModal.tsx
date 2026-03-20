"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Camera, Music, Video, Sparkles, Monitor, Tv, Projector, CircleUser, Lightbulb, Joystick } from "lucide-react";
import { AgentCard, AGENTS, Agent } from "./AgentSprite";

export interface ShowSettings {
  agent: string | null;
  inputType: "camera" | "audio" | "video" | "none";
  controlMode: "audio" | "video" | "hybrid";
  outputType: "obs" | "resolume" | "realset" | "none";
  completed: boolean;
}

const DEFAULT_SETTINGS: ShowSettings = {
  agent: null,
  inputType: "none",
  controlMode: "video",
  outputType: "none",
  completed: false,
};

const STORAGE_KEY = "aifolks_show_settings";

export function loadSettings(): ShowSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: ShowSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (settings: ShowSettings) => void;
}

export default function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<ShowSettings>(DEFAULT_SETTINGS);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const TOTAL_STEPS = 5;

  useEffect(() => {
    if (isOpen) {
      const saved = loadSettings();
      setSettings(saved.completed ? { ...saved, completed: false } : DEFAULT_SETTINGS);
      setCurrentStep(0);
    }
  }, [isOpen]);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
      setCameraError(null);
      setSettings((prev) => ({ ...prev, inputType: "camera" }));
    } catch (error) {
      setCameraError("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setSettings((prev) => ({ ...prev, inputType: "none" }));
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const finalSettings = { ...settings, completed: true };
    saveSettings(finalSettings);
    onComplete(finalSettings);
  };

  const updateSettings = (updates: Partial<ShowSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  if (!isOpen) return null;

  const inputOptions = [
    {
      id: "camera" as const,
      icon: Camera,
      label: "Camera",
      description: "Point your camera to control the show",
    },
    {
      id: "audio" as const,
      icon: Music,
      label: "Microphone",
      description: "Let the music drive the visuals",
    },
    {
      id: "video" as const,
      icon: Video,
      label: "Video File",
      description: "Upload a video loop",
    },
    {
      id: "none" as const,
      icon: Sparkles,
      label: "AI Only",
      description: "AI generates visuals independently",
    },
  ];

  const controlModes = [
    {
      id: "video" as const,
      label: "Video-Controlled",
      description: "Visuals follow your camera movements and gestures",
    },
    {
      id: "audio" as const,
      label: "Audio-Reactive",
      description: "Visuals respond to beat, tempo, and frequency",
    },
    {
      id: "hybrid" as const,
      label: "Hybrid",
      description: "Combine both for dynamic, responsive control",
    },
  ];

  const outputOptions = [
    {
      id: "obs" as const,
      icon: Monitor,
      label: "OBS Studio",
      description: "Stream or record with OBS - the free, open-source video recorder and streaming app",
    },
    {
      id: "resolume" as const,
      icon: Tv,
      label: "Resolume",
      description: "Professional VJ software for live performances and installations",
    },
    {
      id: "realset" as const,
      icon: Projector,
      label: "Real Set",
      description: "Connect to projectors, LED walls, and live venue equipment",
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0f0f10] rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0f0f10] border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-white">Setup Your Show</h2>
            <span className="text-xs text-white/40">
              Step {currentStep + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-yellow-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="p-8">
          {/* Step 1: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Welcome to The AI Folks</h3>
                <p className="text-white/60 text-sm">
                  Create your own AI-powered VJ show. No experience needed - we&apos;ll guide you through setup.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                   1
                  </div>
                  <h4 className="font-medium text-white text-sm">Choose Your Agent</h4>
                  <p className="text-xs text-white/40 mt-1">Pick an AI VJ</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-cyan-500/20 flex items-center justify-center">
                   2
                  </div>
                  <h4 className="font-medium text-white text-sm">Set Your Input Source</h4>
                  <p className="text-xs text-white/40 mt-1">Video or audio</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/20 flex items-center justify-center">
                    3
                  </div>
                  <h4 className="font-medium text-white text-sm">Connect Your Set</h4>
                  <p className="text-xs text-white/40 mt-1">OBS or projector</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Choose Agent */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Choose Your AI Agent</h3>
                <p className="text-white/60 text-sm">
                  Each agent has a unique style and personality. Pick one to be your VJ partner.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                {AGENTS.map((agent) => (
                  <AgentCard
                    key={agent.name}
                    agent={agent}
                    isSelected={settings.agent === agent.name}
                    onClick={() => updateSettings({ agent: agent.name })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Control Mode */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Control Mode</h3>
                <p className="text-white/60 text-sm">
                  How should the AI respond to your input? Choose the mode that suits your style.
                </p>
              </div>

              <div className="space-y-4 mt-6">
                {controlModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateSettings({ controlMode: mode.id })}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      settings.controlMode === mode.id
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{mode.label}</h4>
                        <p className="text-sm text-white/50 mt-1">{mode.description}</p>
                      </div>
                      {settings.controlMode === mode.id && (
                        <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6L5 9L10 3"
                              stroke="black"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Output Setup */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Connect Your Output</h3>
                <p className="text-white/60 text-sm">
                  Where do you want to send your visuals? Select your primary output method.
                </p>
              </div>

              <div className="space-y-4 mt-6">
                {outputOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = settings.outputType === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => updateSettings({ outputType: option.id })}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-yellow-500 bg-yellow-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? "bg-yellow-500/20" : "bg-white/10"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${
                              isSelected ? "text-yellow-500" : "text-white/60"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{option.label}</h4>
                          <p className="text-sm text-white/50 mt-1">{option.description}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6L5 9L10 3"
                                stroke="black"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-8 py-5 bg-[#0f0f10] border-t border-white/10">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-2">
            {[...Array(TOTAL_STEPS)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? "bg-yellow-500" : i < currentStep ? "bg-white/30" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              onClick={handleNext}
              disabled={currentStep === 1 && !settings.agent}
              className="flex items-center gap-2 px-6 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Start Your Show
              <Joystick className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
