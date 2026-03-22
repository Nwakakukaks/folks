"use client";

import { useRef, useEffect } from "react";
import { AgentLog } from "@/hooks/useAgentBrain";
import { Agent } from "@/components/AgentSprite";
import { RotateCcw, Trash2 } from "lucide-react";

interface LogPanelProps {
  logs: AgentLog[];
  agent?: Agent;
  onClear?: () => void;
  onResumeAgent?: () => void;
  userOverrideActive?: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  echo: "#06b6d4",
  vesper: "#ec4899",
  riley: "#f97316",
  maya: "#a855f7",
  luna: "#22c55e",
};

export default function LogPanel({
  logs,
  agent,
  onClear,
  onResumeAgent,
  userOverrideActive = false,
}: LogPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLogIcon = (type: AgentLog["type"]) => {
    switch (type) {
      case "thinking":
        return "🤔";
      case "action":
        return "→";
      case "override":
        return "⚫";
      case "mood_change":
        return "✨";
      case "error":
        return "❌";
      case "system":
        return "⚙️";
      default:
        return "•";
    }
  };

  const getLogColor = (log: AgentLog) => {
    if (log.type === "override" || log.type === "error") {
      return log.type === "error" ? "#ef4444" : "#ffffff";
    }
    return AGENT_COLORS[log.agent.toLowerCase()] || "#ffffff";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          Agent Logs
        </span>
        <div className="flex items-center gap-2">
          {userOverrideActive && onResumeAgent && (
            <button
              onClick={onResumeAgent}
              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-[10px] text-green-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Resume
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3 text-white/40" />
            </button>
          )}
        </div>
      </div>

      {userOverrideActive && (
        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <span className="text-[10px] text-yellow-400">
            User control active - Agent paused
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-white/30">
              Agent logs will appear here
            </span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 text-[10px] leading-relaxed"
            >
              <span className="text-white/30 shrink-0 w-16">
                [{formatTime(log.timestamp)}]
              </span>
              <span
                className="shrink-0 w-4 text-center"
                style={{ color: getLogColor(log) }}
              >
                {getLogIcon(log.type)}
              </span>
              <span
                className="font-medium shrink-0"
                style={{ color: getLogColor(log) }}
              >
                {log.agent.toUpperCase()}
              </span>
              <span className="text-white/60">
                {log.content}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
