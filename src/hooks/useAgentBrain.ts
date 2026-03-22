"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioReactive, AudioReactiveMetrics } from "./useAudioReactive";
import { Agent } from "@/components/AgentSprite";
import { getBackendUrl } from "./useScopeServer";

export interface AgentLog {
  id: string;
  timestamp: Date;
  agent: string;
  type: "thinking" | "action" | "override" | "mood_change" | "error" | "system";
  content: string;
  details?: Record<string, unknown>;
}

interface AgentAction {
  type: "send_parameters" | "send_prompt" | "load_pipeline" | "install_plugin" | "configure_ndi" | "select_effect";
  params?: Record<string, unknown>;
  prompt?: string;
  weight?: number;
  pipeline_id?: string;
  plugin_spec?: string;
  ndi_enabled?: boolean;
  ndi_name?: string;
  effect_number?: number;
}

interface AgentReasonResponse {
  thinking: string;
  actions: AgentAction[];
  mood: string;
  confidence: number;
}

interface UseAgentBrainOptions {
  agent: Agent;
  audioStream: MediaStream | null;
  isActive: boolean;
  scope: {
    sendParameter: (params: Record<string, unknown>) => void;
    loadPipeline: (id: string) => Promise<void>;
    installPlugin: (spec: string) => Promise<void>;
    configureNDI: (enabled: boolean, name: string) => Promise<void>;
    getCurrentPipeline: () => string;
    getCurrentParameters: () => Record<string, unknown>;
    getCurrentPlugins: () => string[];
  };
  onLog: (log: AgentLog) => void;
  onMoodChange: (mood: string) => void;
  onEffectChange?: (effect: number) => void;
  currentEffect?: number;
  reasoningInterval?: number;
}

function summarizeAction(action: AgentAction, agentName: string): string {
  switch (action.type) {
    case "send_prompt":
      if (action.prompt) {
        const preview = action.prompt.length > 50 
          ? action.prompt.substring(0, 50) + "..." 
          : action.prompt;
        return `Injecting prompt: "${preview}"`;
      }
      return "Updating prompt";

    case "send_parameters":
      if (action.params) {
        const keys = Object.keys(action.params);
        if (keys.length === 1) {
          const key = keys[0];
          const value = action.params[key];
          return `Adjusting ${formatParamName(key)} to ${formatValue(value)}`;
        }
        return `Adjusting ${keys.length} parameters`;
      }
      return "Adjusting parameters";

    case "load_pipeline":
      return `Switching to pipeline: ${action.pipeline_id}`;

    case "install_plugin":
      return `Installing plugin: ${action.plugin_spec}`;

    case "configure_ndi":
      return `${action.ndi_enabled ? "Enabling" : "Disabling"} NDI: ${action.ndi_name}`;

    case "select_effect":
      return `Switching to effect ${action.effect_number}`;

    default:
      return `Action: ${action.type}`;
  }
}

function formatParamName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "on" : "off";
  }
  if (typeof value === "number") {
    if (value >= 1) return value.toFixed(1);
    if (value >= 0.1) return value.toFixed(2);
    return value.toFixed(3);
  }
  if (typeof value === "string") {
    if (value.length > 20) return `"${value.substring(0, 20)}..."`;
    return `"${value}"`;
  }
  return String(value);
}

export function useAgentBrain({
  agent,
  audioStream,
  isActive,
  scope,
  onLog,
  onMoodChange,
  onEffectChange,
  currentEffect = 1,
  reasoningInterval = 10000,
}: UseAgentBrainOptions) {
  const [currentMood, setCurrentMood] = useState<string>("neutral");
  const [isReasoning, setIsReasoning] = useState(false);
  const [userOverride, setUserOverride] = useState<{ active: boolean; timestamp: Date | null }>({
    active: false,
    timestamp: null,
  });

  const lastReasoningRef = useRef<Date | null>(null);
  const skillContentRef = useRef<string>("");
  const lastPromptRef = useRef<string>("");
  const lastAudioMetricsRef = useRef<AudioReactiveMetrics | null>(null);

  const { metrics: audioMetrics } = useAudioReactive({
    enabled: isActive && !!audioStream,
    sourceStream: audioStream,
  });

  useEffect(() => {
    lastAudioMetricsRef.current = audioMetrics;
  }, [audioMetrics]);

  useEffect(() => {
    fetch(`/agents/skills/${agent.slug}/SKILL.md`)
      .then((res) => res.text())
      .then((text) => {
        skillContentRef.current = text;
      })
      .catch(() => {
        skillContentRef.current = "";
      });
  }, [agent.slug]);

  const addLog = useCallback(
    (type: AgentLog["type"], content: string, details?: Record<string, unknown>) => {
      const log: AgentLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        agent: agent.name,
        type,
        content,
        details,
      };
      onLog(log);
      return log;
    },
    [agent.name, onLog]
  );

  const executeAction = useCallback(
    async (action: AgentAction) => {
      try {
        switch (action.type) {
          case "send_parameters":
            if (action.params && Object.keys(action.params).length > 0) {
              scope.sendParameter(action.params);
              addLog("action", summarizeAction(action, agent.name));
            }
            break;

          case "send_prompt":
            if (action.prompt && action.prompt !== lastPromptRef.current) {
              scope.sendParameter({
                prompts: [{ text: action.prompt, weight: action.weight || 1.0 }],
              });
              lastPromptRef.current = action.prompt;
              addLog("action", summarizeAction(action, agent.name), { prompt: action.prompt });
            }
            break;

          case "load_pipeline":
            if (action.pipeline_id) {
              await scope.loadPipeline(action.pipeline_id);
              addLog("action", summarizeAction(action, agent.name));
            }
            break;

          case "install_plugin":
            if (action.plugin_spec) {
              await scope.installPlugin(action.plugin_spec);
              addLog("action", summarizeAction(action, agent.name));
            }
            break;

          case "configure_ndi":
            if (action.ndi_enabled !== undefined && action.ndi_name) {
              await scope.configureNDI(action.ndi_enabled, action.ndi_name);
              addLog("action", summarizeAction(action, agent.name));
            }
            break;

          case "select_effect":
            if (action.effect_number && action.effect_number !== currentEffect) {
              onEffectChange?.(action.effect_number);
              addLog("action", summarizeAction(action, agent.name), { effect: action.effect_number });
            }
            break;
        }
      } catch (err) {
        addLog("error", `Action failed: ${err}`);
      }
    },
    [scope, addLog, agent.name, currentEffect, onEffectChange]
  );

  const reason = useCallback(async () => {
    if (!isActive || isReasoning || userOverride.active) return;

    setIsReasoning(true);

    try {
      const metrics = lastAudioMetricsRef.current;
      
      const response = await fetch(`${getBackendUrl()}/api/agents/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agent.slug,
          skill: skillContentRef.current,
          audio_metrics: metrics || {
            overall: 0,
            beatDetected: false,
            tempo: 0,
            mood: "calm",
            dominantRange: "mids",
          },
          current_state: {
            pipeline: scope.getCurrentPipeline(),
            parameters: scope.getCurrentParameters(),
            plugins: scope.getCurrentPlugins(),
            mood: currentMood,
            current_effect: currentEffect,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Reasoning failed: ${response.status}`);
      }

      const result: AgentReasonResponse = await response.json();

      addLog("thinking", result.thinking);

      if (result.mood !== currentMood) {
        setCurrentMood(result.mood);
        onMoodChange(result.mood);
        addLog("mood_change", `Entering ${result.mood.toUpperCase()} state`);
      }

      for (const action of result.actions) {
        await executeAction(action);
      }

      lastReasoningRef.current = new Date();
    } catch (err) {
      console.error("Agent reasoning error:", err);
      addLog("error", `Reasoning failed: ${err}`);
    } finally {
      setIsReasoning(false);
    }
  }, [
    isActive,
    isReasoning,
    userOverride.active,
    agent.slug,
    scope,
    currentMood,
    currentEffect,
    addLog,
    executeAction,
    onMoodChange,
  ]);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(reason, reasoningInterval);
    return () => clearInterval(intervalId);
  }, [isActive, reason, reasoningInterval]);

  useEffect(() => {
    if (isActive && audioStream && !lastReasoningRef.current) {
      reason();
    }
  }, [isActive, audioStream, reason]);

  const handleUserOverride = useCallback(() => {
    setUserOverride({ active: true, timestamp: new Date() });
    addLog("override", "User manually took control");
  }, [addLog]);

  const resumeAgent = useCallback(() => {
    setUserOverride({ active: false, timestamp: null });
    addLog("system", "Agent control resumed");
    setTimeout(reason, 100);
  }, [addLog, reason]);

  return {
    currentMood,
    isReasoning,
    userOverride,
    audioMetrics,
    handleUserOverride,
    resumeAgent,
    addLog,
    setEffect: onEffectChange,
  };
}

export function useAgentStatus() {
  const [status, setStatus] = useState<{
    available: boolean;
    model: string;
  } | null>(null);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/agents/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ available: false, model: "unknown" }));
  }, []);

  return status;
}
