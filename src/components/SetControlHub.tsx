"use client";

import {
  Camera,
  Projector,
  Cog,
  Cpu,
  SlidersHorizontal,
  Layers,
} from "lucide-react";
import { ShowSettings } from "./OnboardingModal";

export type ActiveControlPanel = "input" | "pipeline" | "output" | "controls" | "agent" | "log" | null;

interface SetControlHubProps {
  activePanel: ActiveControlPanel;
  onPanelChange: (panel: ActiveControlPanel) => void;
  settings: ShowSettings | null;
  isConnected: boolean;
  activePipeline?: string;
}

export default function SetControlHub({
  activePanel,
  onPanelChange,
  settings,
  isConnected,
  activePipeline,
}: SetControlHubProps) {
  const isPanelActive = (panel: ActiveControlPanel) => activePanel === panel;

  return (
    <div className="relative z-40">
      <div className="grid gap-2 md:grid-cols-3">
        <button
          onClick={() => onPanelChange(isPanelActive("input") ? null : "input")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("input")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Input</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Modes</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70">{settings?.inputType ?? "Select"}</div>
        </button>

        <button
          onClick={() => onPanelChange(isPanelActive("output") ? null : "output")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("output")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Projector className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Output</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Targets</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70">{settings?.outputType ?? "Select"}</div>
        </button>

        <button
          onClick={() => onPanelChange(isPanelActive("controls") ? null : "controls")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("controls")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cog className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Controls</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Stream</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70">{isConnected ? "Connected" : "Offline"}</div>
        </button>

        <button
          onClick={() => onPanelChange(isPanelActive("agent") ? null : "agent")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("agent")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Agent</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Select</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70">{settings?.agent ?? "Choose"}</div>
        </button>

        <button
          onClick={() => onPanelChange(isPanelActive("log") ? null : "log")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("log")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Log</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Agent</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70">Mental Process</div>
        </button>

        <button
          onClick={() => onPanelChange(isPanelActive("pipeline") ? null : "pipeline")}
          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
            isPanelActive("pipeline")
              ? "border-yellow-500/60 bg-yellow-500/10"
              : "border-white/10 bg-black/60 hover:border-white/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">Pipeline</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Plugins</span>
          </div>
          <div className="mt-1.5 text-xs text-white/70 truncate">{activePipeline ?? "Select"}</div>
        </button>
      </div>
    </div>
  );
}
