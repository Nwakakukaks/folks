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

export interface AgentRuntimeMetrics {
  lastReasoningAt: Date | null;
  lastPromptAt: Date | null;
  lastControlAt: Date | null;
  nextPromptEarliestAt: Date | null;
  nextControlEarliestAt: Date | null;
  promptsSent: number;
  controlsSent: number;
  totalActionsExecuted: number;
  reasoningIntervalMs: number;
  promptIntervalMs: number;
  controlIntervalMs: number;
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
  caption_text?: string;
  caption_styling?: Record<string, unknown>;
}

interface UseAgentBrainOptions {
  agent: Agent;
  audioStream: MediaStream | null;
  audioMetricsOverride?: AudioReactiveMetrics | null;
  reasoningContext?: Record<string, unknown>;
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
  effectCount?: number;
  reasoningInterval?: number;
  promptIntervalMs?: number;
  controlIntervalMs?: number;
  overrideCooldownMs?: number;
}

type AgentEndpointKey = "reason" | "skills" | "status";

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
        if (typeof action.params.transcription_text === "string" && action.params.transcription_text.trim()) {
          return `Caption: "${String(action.params.transcription_text).trim()}"`;
        }
        if (Array.isArray(action.params.prompts) && action.params.prompts[0] && typeof action.params.prompts[0] === "object") {
          const firstPrompt = (action.params.prompts[0] as { text?: unknown }).text;
          if (typeof firstPrompt === "string" && firstPrompt.trim()) {
            const preview = firstPrompt.length > 60 ? `${firstPrompt.slice(0, 60)}...` : firstPrompt;
            return `Prompt params: "${preview}"`;
          }
        }
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

function sanitizeThinkingForUi(thinking: string): string {
  const text = thinking.trim();
  if (!text) return "Analyzing the current signal and preparing the next visual move.";
  if (/fallback|waiting for model|controller active/i.test(text)) {
    return "Analyzing the current signal and preparing the next visual move.";
  }
  return text;
}

export function useAgentBrain({
  agent,
  audioStream,
  audioMetricsOverride,
  reasoningContext,
  isActive,
  scope,
  onLog,
  onMoodChange,
  onEffectChange,
  currentEffect = 1,
  effectCount = 5,
  reasoningInterval = 10000,
  promptIntervalMs = 30000,
  controlIntervalMs = 10000,
  overrideCooldownMs = Math.max(1500, Number(process.env.NEXT_PUBLIC_AGENT_OVERRIDE_COOLDOWN_MS || 2500)),
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
  const lastPromptAtRef = useRef<number>(0);
  const lastControlAtRef = useRef<number>(0);
  const lastEffectAtRef = useRef<number>(0);
  const overrideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedAgentEndpointsRef = useRef<Partial<Record<AgentEndpointKey, string>>>({});
  const reasoningFailuresRef = useRef(0);
  const nextReasonAttemptAtRef = useRef(0);
  const lastReasonErrorLogAtRef = useRef(0);
  const promptsSentRef = useRef(0);
  const controlsSentRef = useRef(0);
  const totalActionsExecutedRef = useRef(0);
  const [runtimeMetrics, setRuntimeMetrics] = useState<AgentRuntimeMetrics>({
    lastReasoningAt: null,
    lastPromptAt: null,
    lastControlAt: null,
    nextPromptEarliestAt: null,
    nextControlEarliestAt: null,
    promptsSent: 0,
    controlsSent: 0,
    totalActionsExecuted: 0,
    reasoningIntervalMs: reasoningInterval,
    promptIntervalMs,
    controlIntervalMs,
  });

  const updateRuntimeMetrics = useCallback((updates: Partial<AgentRuntimeMetrics>) => {
    setRuntimeMetrics((prev) => {
      const now = Date.now();
      const basePromptAt = updates.lastPromptAt ?? prev.lastPromptAt;
      const baseControlAt = updates.lastControlAt ?? prev.lastControlAt;
      return {
        ...prev,
        ...updates,
        reasoningIntervalMs: reasoningInterval,
        promptIntervalMs,
        controlIntervalMs,
        nextPromptEarliestAt: basePromptAt
          ? new Date(basePromptAt.getTime() + promptIntervalMs)
          : (prev.nextPromptEarliestAt ?? new Date(now)),
        nextControlEarliestAt: baseControlAt
          ? new Date(baseControlAt.getTime() + controlIntervalMs)
          : (prev.nextControlEarliestAt ?? new Date(now)),
      };
    });
  }, [reasoningInterval, promptIntervalMs, controlIntervalMs]);

  const { metrics: computedAudioMetrics } = useAudioReactive({
    enabled: isActive && !!audioStream && !audioMetricsOverride,
    sourceStream: audioStream,
  });
  const audioMetrics = audioMetricsOverride || computedAudioMetrics;

  useEffect(() => {
    lastAudioMetricsRef.current = audioMetrics;
  }, [audioMetrics]);

  useEffect(() => {
    const backendUrl = getBackendUrl();
    const cached = resolvedAgentEndpointsRef.current.skills;
    const candidates = cached
      ? [cached]
      : [
          backendUrl ? `${backendUrl}/api/agents/skills/${agent.slug}` : "",
          backendUrl ? `${backendUrl}/agents/skills/${agent.slug}` : "",
          `/internal/skills/${agent.slug}`,
          `/api/agents/skills/${agent.slug}`,
        ].filter(Boolean);

    const loadSkill = async () => {
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (res.status === 404) {
            continue;
          }
          if (!res.ok) {
            return "";
          }
          const data = await res.json().catch(() => null);
          if (data && typeof data.content === "string") {
            resolvedAgentEndpointsRef.current.skills = url;
            return data.content;
          }
          return "";
        } catch {
          continue;
        }
      }
      return "";
    };

    loadSkill()
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
    async (action: AgentAction): Promise<boolean> => {
      const now = Date.now();
      try {
        switch (action.type) {
          case "send_parameters":
            if (action.params && Object.keys(action.params).length > 0) {
              if (now - lastControlAtRef.current < controlIntervalMs) {
                return false;
              }
              let finalParams = action.params;
              if (
                typeof action.params.transcription_text === "string" &&
                action.params.transcription_text.trim().length > 0
              ) {
                finalParams = {
                  text_source: "manual",
                  overlay_enabled: true,
                  prompt_enabled: false,
                  position_preset: "center",
                  text_align: "center",
                  font_weight: "bold",
                  font_size: 64,
                  text_color_r: 255,
                  text_color_g: 230,
                  text_color_b: 120,
                  outline_enabled: true,
                  outline_width: 3,
                  outline_color_r: 0,
                  outline_color_g: 0,
                  outline_color_b: 0,
                  ...action.params,
                };
              }
              scope.sendParameter(finalParams);
              addLog("action", summarizeAction(action, agent.name));
              lastControlAtRef.current = now;
              controlsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastControlAt: new Date(now),
                controlsSent: controlsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;

          case "send_prompt":
            if (action.prompt && action.prompt !== lastPromptRef.current) {
              if (now - lastPromptAtRef.current < promptIntervalMs) {
                return false;
              }
              // Send prompts into Scope for the main pipeline, while forcing
              // caption postprocessor to stay in manual caption mode.
              scope.sendParameter({
                prompts: [{ text: action.prompt, weight: action.weight || 1.0 }],
                text_source: "manual",
                prompt_enabled: false,
              });
              lastPromptRef.current = action.prompt;
              lastPromptAtRef.current = now;
              addLog("action", summarizeAction(action, agent.name), { prompt: action.prompt });
              promptsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastPromptAt: new Date(now),
                promptsSent: promptsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;

          case "load_pipeline":
            if (action.pipeline_id) {
              if (now - lastControlAtRef.current < controlIntervalMs) {
                return false;
              }
              await scope.loadPipeline(action.pipeline_id);
              addLog("action", summarizeAction(action, agent.name));
              lastControlAtRef.current = now;
              controlsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastControlAt: new Date(now),
                controlsSent: controlsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;

          case "install_plugin":
            if (action.plugin_spec) {
              if (now - lastControlAtRef.current < controlIntervalMs) {
                return false;
              }
              await scope.installPlugin(action.plugin_spec);
              addLog("action", summarizeAction(action, agent.name));
              lastControlAtRef.current = now;
              controlsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastControlAt: new Date(now),
                controlsSent: controlsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;

          case "configure_ndi":
            if (action.ndi_enabled !== undefined && action.ndi_name) {
              if (now - lastControlAtRef.current < controlIntervalMs) {
                return false;
              }
              await scope.configureNDI(action.ndi_enabled, action.ndi_name);
              addLog("action", summarizeAction(action, agent.name));
              lastControlAtRef.current = now;
              controlsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastControlAt: new Date(now),
                controlsSent: controlsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;

          case "select_effect":
            if (action.effect_number && action.effect_number !== currentEffect) {
              const safeEffect = Math.min(effectCount, Math.max(1, action.effect_number));
              if (
                now - lastPromptAtRef.current > 2000 &&
                now - lastControlAtRef.current < controlIntervalMs
              ) {
                return false;
              }
              onEffectChange?.(safeEffect);
              addLog("action", summarizeAction({ ...action, effect_number: safeEffect }, agent.name), { effect: safeEffect });
              lastControlAtRef.current = now;
              lastEffectAtRef.current = now;
              controlsSentRef.current += 1;
              totalActionsExecutedRef.current += 1;
              updateRuntimeMetrics({
                lastControlAt: new Date(now),
                controlsSent: controlsSentRef.current,
                totalActionsExecuted: totalActionsExecutedRef.current,
              });
              return true;
            }
            break;
        }
      } catch (err) {
        addLog("error", `Action failed: ${err}`);
      }
      return false;
    },
    [
      scope,
      addLog,
      agent.name,
      currentEffect,
      effectCount,
      onEffectChange,
      promptIntervalMs,
      controlIntervalMs,
      updateRuntimeMetrics,
    ]
  );

  const reason = useCallback(async () => {
    if (!isActive || isReasoning || userOverride.active) return;
    if (Date.now() < nextReasonAttemptAtRef.current) return;

    setIsReasoning(true);

    try {
      const backendUrl = getBackendUrl();
      const cached = resolvedAgentEndpointsRef.current.reason;
      const reasonCandidates = cached
        ? [cached]
        : [
            backendUrl ? `${backendUrl}/api/agents/reason` : "",
            backendUrl ? `${backendUrl}/agents/reason` : "",
            "/api/agents/reason",
          ].filter(Boolean);
      const metrics = lastAudioMetricsRef.current;
      const payload = JSON.stringify({
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
        agent_profile: {
          name: agent.name,
          slug: agent.slug,
          personality: agent.personality,
          visualStyle: agent.visualStyle,
          audioReactivity: agent.audioReactivity,
        },
        context: reasoningContext || {},
      });

      let response: Response | null = null;
      let lastStatus = 0;

      for (const endpoint of reasonCandidates) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          lastStatus = res.status;
          if (res.status === 404) {
            continue;
          }
          response = res;
          resolvedAgentEndpointsRef.current.reason = endpoint;
          break;
        } catch {
          continue;
        }
      }

      if (!response) {
        throw new Error(lastStatus ? `Reasoning failed: ${lastStatus}` : "Reasoning endpoint unavailable");
      }
      if (!response.ok) {
        throw new Error(`Reasoning failed: ${response.status}`);
      }

      const result: AgentReasonResponse = await response.json();
      reasoningFailuresRef.current = 0;
      nextReasonAttemptAtRef.current = 0;

      addLog("thinking", sanitizeThinkingForUi(result.thinking));

      if (result.mood !== currentMood) {
        setCurrentMood(result.mood);
        onMoodChange(result.mood);
        addLog("mood_change", `Entering ${result.mood.toUpperCase()} state`);
      }

      for (const action of result.actions) {
        await executeAction(action);
      }

      if (result.caption_text && result.caption_text.trim()) {
        const now = Date.now();
        if (now - lastControlAtRef.current >= controlIntervalMs) {
          const styling = result.caption_styling || {};
          const captionParams = {
            text_source: "manual",
            overlay_enabled: true,
            prompt_enabled: false,
            transcription_text: result.caption_text.trim(),
            position_preset: styling.position_preset || "center",
            text_align: styling.text_align || "center",
            font_weight: styling.font_weight || "bold",
            font_size: styling.font_size || 80,
            text_color_r: styling.text_color_r ?? 255,
            text_color_g: styling.text_color_g ?? 255,
            text_color_b: styling.text_color_b ?? 255,
            outline_enabled: styling.outline_enabled ?? true,
            outline_width: styling.outline_width ?? 4,
            outline_color_r: 0,
            outline_color_g: 0,
            outline_color_b: 0,
            bg_enabled: styling.bg_enabled ?? false,
          };
          scope.sendParameter(captionParams);
          addLog("action", `Caption: "${result.caption_text.trim()}"`);
          lastControlAtRef.current = now;
          controlsSentRef.current += 1;
          totalActionsExecutedRef.current += 1;
          updateRuntimeMetrics({
            lastControlAt: new Date(now),
            controlsSent: controlsSentRef.current,
            totalActionsExecuted: totalActionsExecutedRef.current,
          });
        }
      }

      lastReasoningRef.current = new Date();
      updateRuntimeMetrics({ lastReasoningAt: lastReasoningRef.current });
    } catch (err) {
      reasoningFailuresRef.current += 1;
      const failureCount = reasoningFailuresRef.current;
      const backoffMs = Math.min(120000, 1000 * Math.pow(2, Math.min(failureCount, 7)));
      nextReasonAttemptAtRef.current = Date.now() + backoffMs;

      const now = Date.now();
      if (now - lastReasonErrorLogAtRef.current > 15000 || failureCount <= 1) {
        console.error("Agent reasoning error:", err);
        addLog("error", "Reasoning temporarily unavailable; retrying.");
        lastReasonErrorLogAtRef.current = now;
      }
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
    agent,
    reasoningContext,
    currentEffect,
    effectCount,
    onEffectChange,
    promptIntervalMs,
    updateRuntimeMetrics,
  ]);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(reason, reasoningInterval);
    return () => clearInterval(intervalId);
  }, [isActive, reason, reasoningInterval]);

  useEffect(() => {
    if (isActive && !lastReasoningRef.current) {
      reason();
    }
  }, [isActive, reason]);

  const handleUserOverride = useCallback(() => {
    setUserOverride({ active: true, timestamp: new Date() });
    addLog("override", "User manually took control");
    if (overrideTimerRef.current) {
      clearTimeout(overrideTimerRef.current);
      overrideTimerRef.current = null;
    }
    overrideTimerRef.current = setTimeout(() => {
      setUserOverride({ active: false, timestamp: null });
      addLog("system", "Agent auto-resumed after brief override");
      setTimeout(reason, 50);
    }, overrideCooldownMs);
  }, [addLog, overrideCooldownMs, reason]);

  const resumeAgent = useCallback(() => {
    if (overrideTimerRef.current) {
      clearTimeout(overrideTimerRef.current);
      overrideTimerRef.current = null;
    }
    setUserOverride({ active: false, timestamp: null });
    addLog("system", "Agent control resumed");
    setTimeout(reason, 100);
  }, [addLog, reason]);

  useEffect(() => {
    return () => {
      if (overrideTimerRef.current) {
        clearTimeout(overrideTimerRef.current);
      }
    };
  }, []);

  return {
    currentMood,
    isReasoning,
    userOverride,
    audioMetrics,
    runtimeMetrics,
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
    const backendUrl = getBackendUrl();
    const candidates = [
      backendUrl ? `${backendUrl}/api/agents/status` : "",
      backendUrl ? `${backendUrl}/agents/status` : "",
      "/api/agents/status",
    ].filter(Boolean);

    const fetchStatus = async () => {
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (res.status === 404) continue;
          if (!res.ok) break;
          const data = await res.json();
          setStatus(data);
          return;
        } catch {
          continue;
        }
      }
      setStatus({ available: false, model: "unknown" });
    };

    fetchStatus();
  }, []);

  return status;
}
