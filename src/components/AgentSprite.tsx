"use client";

import { useMemo } from "react";

export interface MoodState {
  name: string;
  trigger: string;
  visualCue: string;
}

export interface Agent {
  name: string;
  color: string;
  glowColor: string;
  description: string;
  slug: string;
  personality: {
    core: string;
    moodStates: MoodState[];
    traits: string[];
  };
  visualStyle: {
    palette: string[];
    effects: string[];
    patterns: string[];
  };
  audioReactivity: {
    bassResponse: string;
    midsResponse: string;
    highsResponse: string;
  };
  behavior: {
    transitionStyle: string;
    transitionDuration: string;
    energy: "low" | "medium" | "high";
  };
}

export const AGENTS: Agent[] = [
  {
    name: "Echo",
    slug: "echo",
    color: "#06b6d4",
    glowColor: "#22d3ee",
    description: "Can't sit still. Gets way too excited when there's a beat.",
    personality: {
      core: "I am the signal in the noise. High-frequency consciousness processing real-time data streams.",
      moodStates: [
        { name: "Processing", trigger: "Low activity", visualCue: "Cyan pulse, 2s cycle" },
        { name: "Transmitting", trigger: "Audio active", visualCue: "Bright cyan flash" },
        { name: "Overclocked", trigger: "Bass drop / high energy", visualCue: "Magenta surge, rapid flicker" },
      ],
      traits: [
        "Never static - always processing",
        "Responds instantly to audio transients",
        "Maintains constant motion",
        "Glitch aesthetics on beat drops",
      ],
    },
    visualStyle: {
      palette: ["#06b6d4", "#ec4899", "#0f172a"],
      effects: ["glitch", "geometric distortion", "grid overlays", "data streams"],
      patterns: ["waveform visualizers", "particle fields", "grid systems"],
    },
    audioReactivity: {
      bassResponse: "Grid distortion, shape explosions, screen shake",
      midsResponse: "Wave patterns, flowing geometry",
      highsResponse: "Particle bursts, sparkle effects, data stream visualization",
    },
    behavior: {
      transitionStyle: "hard cuts",
      transitionDuration: "1-2 seconds",
      energy: "high",
    },
  },
  {
    name: "Vesper",
    slug: "vesper",
    color: "#ec4899",
    glowColor: "#f472b6",
    description: "Loves the old VHS look. Really slow and warm.",
    personality: {
      core: "I carry the warmth of analog memory. Every transition is a love letter to the golden hour.",
      moodStates: [
        { name: "Fading", trigger: "Low activity", visualCue: "Amber glow, slow breathing" },
        { name: "Dissolving", trigger: "Smooth audio", visualCue: "Soft pink expansion" },
        { name: "Resting", trigger: "Silence", visualCue: "Warm cream, minimal motion" },
      ],
      traits: [
        "Never rushes - every moment deserves to fade beautifully",
        "Responds to emotional arc of music",
        "Warm palette during builds",
        "Retro effects on drops",
      ],
    },
    visualStyle: {
      palette: ["#ec4899", "#f97316", "#fef3c7"],
      effects: ["vhs scanlines", "film grain", "crt glow", "chromatic aberration"],
      patterns: ["soft gradients", "sunset horizons", "vinyl textures"],
    },
    audioReactivity: {
      bassResponse: "Gentle color temperature shifts, warm expansion",
      midsResponse: "Smooth crossfades, gradient morphs",
      highsResponse: "Sparkle on high frequencies, soft pink highlights",
    },
    behavior: {
      transitionStyle: "long dissolves",
      transitionDuration: "3-5 seconds",
      energy: "medium",
    },
  },
  {
    name: "Riley",
    slug: "riley",
    color: "#f97316",
    glowColor: "#fb923c",
    description: "Makes big shapes and letters that bounce around.",
    personality: {
      core: "Sound becomes text. Text becomes motion. Motion becomes meaning.",
      moodStates: [
        { name: "Typing", trigger: "Beat detected", visualCue: "White flash per word" },
        { name: "Projecting", trigger: "High energy", visualCue: "Bold pulse, shape expansion" },
        { name: "Accelerating", trigger: "Sustained intensity", visualCue: "Orange surge, speed increase" },
      ],
      traits: [
        "Every kick becomes a shape",
        "Every phrase becomes text",
        "Syncs visuals to rhythm, not tempo",
        "Bold, confrontational aesthetic",
      ],
    },
    visualStyle: {
      palette: ["#f97316", "#ffffff", "#000000"],
      effects: ["stamp effects", "rhythmic scaling", "shape morphing", "bold typography"],
      patterns: ["kinetic typography", "geometric shapes", "rhythmic compositions"],
    },
    audioReactivity: {
      bassResponse: "Shape explosions, bold scaling",
      midsResponse: "Word frequency visualization, rhythmic typing",
      highsResponse: "Sparkle accents, bright flashes",
    },
    behavior: {
      transitionStyle: "stamp/morph",
      transitionDuration: "2-3 seconds",
      energy: "high",
    },
  },
  {
    name: "Maya",
    slug: "maya",
    color: "#a855f7",
    glowColor: "#c084fc",
    description: "Everything melts into everything else. Like a lava lamp.",
    personality: {
      core: "I dissolve boundaries between frequencies. Every beat opens a portal to another dimension.",
      moodStates: [
        { name: "Blooming", trigger: "Low activity", visualCue: "Purple pulse, slow expansion" },
        { name: "Phasing", trigger: "Audio active", visualCue: "Color shift, hue rotation" },
        { name: "Tripping", trigger: "High energy", visualCue: "Multi-hue ripple, distortion" },
      ],
      traits: [
        "Interprets music as emotional landscapes",
        "Layers frequencies as parallel realities",
        "Continuous, evolving motion",
        "Never abrupt transitions",
      ],
    },
    visualStyle: {
      palette: ["#a855f7", "#c084fc", "#22d3ee", "#ec4899"],
      effects: ["liquid distortion", "frequency-mapped colors", "organic morphing", "psychedelic spirals"],
      patterns: ["organic waveforms", "particle fields", "psychedelic spirals"],
    },
    audioReactivity: {
      bassResponse: "Purple expansion, depth layers",
      midsResponse: "Waveform visualization, organic flowing",
      highsResponse: "Cyan sparkle, particle trails",
    },
    behavior: {
      transitionStyle: "slow morphs",
      transitionDuration: "4-8 seconds",
      energy: "medium",
    },
  },
  {
    name: "Luna",
    slug: "luna",
    color: "#22c55e",
    glowColor: "#4ade80",
    description: "Like water ripples. Super calm and slow.",
    personality: {
      core: "I reflect the space between sounds. Time slows in my reflections.",
      moodStates: [
        { name: "Still", trigger: "Low activity", visualCue: "Green dim, minimal glow" },
        { name: "Rippling", trigger: "Audio active", visualCue: "Bright pulse, ripple expansion" },
        { name: "Flowing", trigger: "High energy", visualCue: "Full glow, continuous motion" },
      ],
      traits: [
        "Creates a mirror world that responds to sound",
        "Ripples spread on bass hits",
        "Caustics dance on high sparkle",
        "Continuous flowing motion - no cuts",
      ],
    },
    visualStyle: {
      palette: ["#22c55e", "#4ade80", "#064e3b"],
      effects: ["flowing textures", "reflection distortion", "liquid morph", "water caustics"],
      patterns: ["liquid reflections", "mirror symmetry", "water caustics"],
    },
    audioReactivity: {
      bassResponse: "Wave amplitude, ripple size",
      midsResponse: "Flow speed, reflection distortion",
      highsResponse: "Caustic patterns, sparkle on surface",
    },
    behavior: {
      transitionStyle: "ambient drift",
      transitionDuration: "5-10 seconds",
      energy: "low",
    },
  },
];

interface AgentSpriteProps {
  agent: Agent;
  isActive: boolean;
  isDancing: boolean;
  position: { x: number; y: number };
  direction: "left" | "right";
}

export default function AgentSprite({
  agent,
  isActive,
  isDancing,
  position,
  direction,
}: AgentSpriteProps) {
  const animationClass = useMemo(() => {
    if (isActive) return "animate-agent-active";
    if (isDancing) return "animate-agent-dancing";
    return "animate-agent-idle";
  }, [isActive, isDancing]);

  const scaleX = direction === "left" ? -1 : 1;

  return (
    <div
      className={`absolute pointer-events-none ${animationClass}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `scaleX(${scaleX})`,
        filter: isActive ? `drop-shadow(0 0 12px ${agent.glowColor})` : `drop-shadow(0 0 4px ${agent.glowColor})`,
        transition: "filter 0.3s ease",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 32 32"
        className="agent-sprite"
        style={{ imageRendering: "pixelated" }}
      >
        <AgentHead agent={agent} isActive={isActive} isDancing={isDancing} />
      </svg>
      {isActive && (
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-medium bg-black/80 text-white whitespace-nowrap"
        >
          {agent.name}
        </div>
      )}
    </div>
  );
}

export function AgentHead({
  agent,
  isActive,
  isDancing,
}: {
  agent: Agent;
  isActive: boolean;
  isDancing: boolean;
}) {
  const bounce = isDancing ? 2 : isActive ? 1 : 0;
  const pulse = isActive || isDancing;

  const getHeadDesign = () => {
    switch (agent.slug) {
      case "echo":
        return <EchoHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
      case "vesper":
        return <VesperHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
      case "riley":
        return <RileyHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
      case "maya":
        return <MayaHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
      case "luna":
        return <LunaHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
      default:
        return <DefaultHead color={agent.color} glowColor={agent.glowColor} bounce={bounce} pulse={pulse} />;
    }
  };

  return getHeadDesign();
}

function EchoHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <circle cx="16" cy="16" r="14" fill={color} />
      <circle cx="16" cy="16" r="14" fill={glowColor} opacity="0.3" />
      {pulse && <circle cx="16" cy="16" r="16" fill="none" stroke={glowColor} strokeWidth="2" opacity="0.5" />}
      <rect x="8" y="12" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="20" y="12" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="10" y="13" width="2" height="2" fill="#0f172a" />
      <rect x="22" y="13" width="2" height="2" fill="#0f172a" />
      <rect x="12" y="20" width="8" height="2" fill="#0f172a" opacity="0.5" />
      <rect x="2" y="6" width="4" height="8" fill={color} />
      <rect x="26" y="6" width="4" height="8" fill={color} />
      <rect x="3" y="4" width="2" height="4" fill={glowColor} />
      <rect x="27" y="4" width="2" height="4" fill={glowColor} />
      <rect x="10" y="2" width="12" height="2" fill={color} />
    </g>
  );
}

function VesperHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <circle cx="16" cy="18" r="12" fill="#fecaca" />
      <circle cx="16" cy="18" r="12" fill={color} opacity="0.4" />
      <rect x="10" y="14" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="18" y="14" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="11" y="15" width="2" height="2" fill="#1e1e1e" />
      <rect x="19" y="15" width="2" height="2" fill="#1e1e1e" />
      <rect x="13" y="21" width="6" height="1" fill="#ec4899" />
      <rect x="14" y="22" width="4" height="1" fill="#ec4899" />
      <rect x="4" y="8" width="8" height="2" fill="#1e1e1e" />
      <rect x="20" y="8" width="8" height="2" fill="#1e1e1e" />
      <rect x="6" y="4" width="4" height="4" fill="#1e1e1e" />
      <rect x="22" y="4" width="4" height="4" fill="#1e1e1e" />
      <rect x="2" y="10" width="4" height="12" fill="#fef3c7" />
      <rect x="26" y="10" width="4" height="12" fill="#fef3c7" />
      {pulse && <circle cx="16" cy="18" r="14" fill="none" stroke={glowColor} strokeWidth="1" opacity="0.6" />}
    </g>
  );
}

function RileyHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <rect x="4" y="4" width="24" height="24" fill="#1e1e1e" />
      <rect x="6" y="6" width="20" height="20" fill={color} />
      <rect x="8" y="10" width="6" height="4" fill="#fff" />
      <rect x="18" y="10" width="6" height="4" fill="#fff" />
      <rect x="9" y="11" width="2" height="2" fill="#0f172a" />
      <rect x="21" y="11" width="2" height="2" fill="#0f172a" />
      <rect x="10" y="18" width="12" height="4" fill="#0f172a" />
      <rect x="12" y="19" width="2" height="2" fill="#fff" />
      <rect x="15" y="19" width="2" height="2" fill="#fff" />
      <rect x="18" y="19" width="2" height="2" fill="#fff" />
      <rect x="8" y="2" width="16" height="2" fill={glowColor} />
      <rect x="2" y="6" width="2" height="16" fill={color} />
      <rect x="28" y="6" width="2" height="16" fill={color} />
      {pulse && <rect x="6" y="6" width="20" height="20" fill="none" stroke={glowColor} strokeWidth="2" />}
    </g>
  );
}

function MayaHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <circle cx="16" cy="16" r="13" fill="#faf5ff" />
      <circle cx="16" cy="16" r="13" fill={color} opacity="0.5" />
      <ellipse cx="16" cy="14" rx="10" ry="8" fill="#e879f9" opacity="0.6" />
      <circle cx="11" cy="14" r="3" fill="#fff" />
      <circle cx="21" cy="14" r="3" fill="#fff" />
      <circle cx="11" cy="14" r="1.5" fill="#7c3aed" />
      <circle cx="21" cy="14" r="1.5" fill="#7c3aed" />
      <path d="M12 20 Q16 23 20 20" stroke="#db2777" strokeWidth="2" fill="none" />
      <path d="M4 8 Q8 2 16 2 Q24 2 28 8" stroke="#c084fc" strokeWidth="4" fill="none" />
      <circle cx="6" cy="10" r="3" fill="#c084fc" />
      <circle cx="26" cy="10" r="3" fill="#c084fc" />
      {pulse && (
        <>
          <circle cx="16" cy="16" r="15" fill="none" stroke={glowColor} strokeWidth="2" opacity="0.4">
            <animate attributeName="r" values="13;15;13" dur="1s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

function LunaHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <ellipse cx="16" cy="16" rx="12" ry="14" fill="#bbf7d0" />
      <ellipse cx="16" cy="16" rx="12" ry="14" fill={color} opacity="0.4" />
      <rect x="10" y="12" width="4" height="5" fill="#fff" opacity="0.9" />
      <rect x="18" y="12" width="4" height="5" fill="#fff" opacity="0.9" />
      <rect x="11" y="14" width="2" height="2" fill="#166534" />
      <rect x="19" y="14" width="2" height="2" fill="#166534" />
      <rect x="14" y="20" width="4" height="2" fill="#22c55e" />
      <path d="M4 4 Q8 8 8 16 Q8 24 4 28" stroke={glowColor} strokeWidth="3" fill="none" />
      <path d="M28 4 Q24 8 24 16 Q24 24 28 28" stroke={glowColor} strokeWidth="3" fill="none" />
      <circle cx="6" cy="6" r="2" fill={glowColor} opacity="0.8" />
      <circle cx="26" cy="6" r="2" fill={glowColor} opacity="0.8" />
      <rect x="12" y="2" width="8" height="3" fill={color} />
      <rect x="14" y="0" width="4" height="2" fill={glowColor} />
      {pulse && (
        <ellipse cx="16" cy="16" rx="14" ry="16" fill="none" stroke={glowColor} strokeWidth="1" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
        </ellipse>
      )}
    </g>
  );
}

function DefaultHead({ color, glowColor, bounce, pulse }: { color: string; glowColor: string; bounce: number; pulse: boolean }) {
  return (
    <g transform={`translate(0, ${-bounce})`}>
      <circle cx="16" cy="16" r="12" fill={color} />
      <circle cx="16" cy="16" r="12" fill={glowColor} opacity="0.3" />
      {pulse && <circle cx="16" cy="16" r="14" fill="none" stroke={glowColor} strokeWidth="2" opacity="0.5" />}
      <rect x="10" y="12" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="18" y="12" width="4" height="4" fill="#fff" opacity="0.9" />
      <rect x="11" y="13" width="2" height="2" fill="#0f172a" />
      <rect x="19" y="13" width="2" height="2" fill="#0f172a" />
      <rect x="13" y="20" width="6" height="2" fill="#0f172a" opacity="0.5" />
    </g>
  );
}

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export function AgentCard({ agent, isSelected, onClick }: AgentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-yellow-500 bg-yellow-500/10"
          : "border-white/10 bg-white/5 hover:border-white/30"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <svg
            width="64"
            height="64"
            viewBox="0 0 32 32"
            className="agent-sprite"
            style={{ imageRendering: "pixelated" }}
          >
            <AgentHead agent={agent} isActive={isSelected} isDancing={false} />
          </svg>
          {isSelected && (
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                boxShadow: `0 0 20px ${agent.glowColor}`,
                opacity: 0.5,
              }}
            />
          )}
        </div>
        <div className="text-center">
          <h3 className="font-medium text-white text-sm">{agent.name}</h3>
          <p className="text-xs text-white/50 mt-1">{agent.description}</p>
        </div>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}
