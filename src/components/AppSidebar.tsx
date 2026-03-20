"use client";

import { useState } from "react";
import { 
  Video, 
  Mic, 
  Monitor, 
  Tv, 
  Projector,
  Wifi, 
  Play,
  ChevronDown, 
  ChevronRight,
  BookOpen,
  HelpCircle,
} from "lucide-react";

export type SidebarMode = "fullscreen" | "extended" | "hidden";
export type ActivePanel = "input" | "output" | "stream" | null;

interface AppSidebarProps {
  mode?: SidebarMode;
  onModeChange?: (mode: SidebarMode) => void;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
}

const guideItems = [
  { title: "Getting Started", description: "Learn the basics of The AI Folks" },
  { title: "Input Setup", description: "Configure camera and audio input" },
  { title: "Output Options", description: "Connect to OBS, Resolume, or Real Set" },
  { title: "Stream Controls", description: "Manage your live stream connection" },
];

export default function AppSidebar({ mode = "extended", onModeChange, activePanel, onPanelChange }: AppSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Input", "Output", "Stream", "Guides"]);
  const [guidesExpanded, setGuidesExpanded] = useState(false);

  const toggleCategory = (name: string) => {
    if (expandedCategories.includes(name)) {
      setExpandedCategories(expandedCategories.filter((n) => n !== name));
    } else {
      setExpandedCategories([...expandedCategories, name]);
    }
  };

  const isPanelActive = (panel: string) => activePanel === panel;

  if (mode === "fullscreen") {
    return (
      <div className="w-full h-full bg-black/30 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {["Input", "Output", "Stream", "Guides"].map((category) => (
            <div key={category} className="mb-4">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <span>{category}</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 transition-transform ${expandedCategories.includes(category) ? "rotate-180" : ""}`}
                />
              </button>
              {expandedCategories.includes(category) && (
                <div className="mt-2 space-y-1 pl-2">
                  {category === "Input" && (
                    <>
                      <button
                        onClick={() => onPanelChange("input")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isPanelActive("input") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                        }`}
                      >
                        <Video className="w-4 h-4" />
                        <span className="text-sm">Video Input</span>
                      </button>
                      <button
                        onClick={() => onPanelChange("input")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isPanelActive("input") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                        }`}
                      >
                        <Mic className="w-4 h-4" />
                        <span className="text-sm">Audio Input</span>
                      </button>
                    </>
                  )}
                  {category === "Output" && (
                    <>
                      <button
                        onClick={() => onPanelChange("output")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm">OBS Studio</span>
                      </button>
                      <button
                        onClick={() => onPanelChange("output")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                        }`}
                      >
                        <Tv className="w-4 h-4" />
                        <span className="text-sm">Resolume</span>
                      </button>
                      <button
                        onClick={() => onPanelChange("output")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                        }`}
                      >
                        <Projector className="w-4 h-4" />
                        <span className="text-sm">Real Set</span>
                      </button>
                    </>
                  )}
                  {category === "Stream" && (
                    <button
                      onClick={() => onPanelChange("stream")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isPanelActive("stream") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/70"
                      }`}
                    >
                      <Wifi className="w-4 h-4" />
                      <span className="text-sm">Stream Controls</span>
                    </button>
                  )}
                  {category === "Guides" && (
                    <div className="space-y-1">
                      {guideItems.map((item) => (
                        <button
                          key={item.title}
                          className="w-full flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-white/10 text-white/70 transition-colors text-left"
                        >
                          <HelpCircle className="w-4 h-4 mt-0.5" />
                          <div>
                            <div className="text-sm">{item.title}</div>
                            <div className="text-xs text-white/40">{item.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => onModeChange?.("extended")}
            className="w-full px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-center"
          >
            Exit Fullscreen
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-56 shrink-0 bg-[#0a0a0a] border-r border-white/10 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-2">
        {["Input", "Output", "Stream", "Guides"].map((category) => (
          <div key={category} className="mb-1">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="text-white/50">{category}</span>
              {expandedCategories.includes(category) ? (
                <ChevronDown className="w-3 h-3 text-white/30" />
              ) : (
                <ChevronRight className="w-3 h-3 text-white/30" />
              )}
            </button>
            {expandedCategories.includes(category) && (
              <div className="mt-1 ml-2 space-y-0.5">
                {category === "Input" && (
                  <>
                    <button
                      onClick={() => onPanelChange("input")}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isPanelActive("input") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      <span className="text-xs">Video</span>
                    </button>
                    <button
                      onClick={() => onPanelChange("input")}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isPanelActive("input") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      <span className="text-xs">Audio</span>
                    </button>
                  </>
                )}
                {category === "Output" && (
                  <>
                    <button
                      onClick={() => onPanelChange("output")}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span className="text-xs">OBS</span>
                    </button>
                    <button
                      onClick={() => onPanelChange("output")}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <Tv className="w-4 h-4" />
                      <span className="text-xs">Resolume</span>
                    </button>
                    <button
                      onClick={() => onPanelChange("output")}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isPanelActive("output") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <Projector className="w-4 h-4" />
                      <span className="text-xs">Real Set</span>
                    </button>
                  </>
                )}
                {category === "Stream" && (
                  <button
                    onClick={() => onPanelChange("stream")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isPanelActive("stream") ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/60"
                    }`}
                  >
                    <Wifi className="w-4 h-4" />
                    <span className="text-xs">Stream Controls</span>
                  </button>
                )}
                {category === "Guides" && (
                  <div className="space-y-0.5">
                    {guideItems.map((item) => (
                      <button
                        key={item.title}
                        className="w-full flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-white/50 transition-colors text-left"
                      >
                        <HelpCircle className="w-3 h-3 mt-0.5" />
                        <div>
                          <div className="text-[10px]">{item.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
