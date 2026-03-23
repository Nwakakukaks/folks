"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENTS, Agent } from "@/components/AgentSprite";
import {
  DEFAULT_WEEKLY_AGENT_SCHEDULE,
  findNextScheduleTransition,
  getActiveScheduledAgent,
  AgentScheduleSlot,
} from "@/lib/agentSchedule";

interface UseAgentScheduleOptions {
  enabled: boolean;
  schedule?: AgentScheduleSlot[];
  refreshMs?: number;
}

interface UseAgentScheduleResult {
  activeAgent: Agent | null;
  activeSlot: AgentScheduleSlot | null;
  nextTransitionAt: Date | null;
}

export function useAgentSchedule({
  enabled,
  schedule = DEFAULT_WEEKLY_AGENT_SCHEDULE,
  refreshMs = 30_000,
}: UseAgentScheduleOptions): UseAgentScheduleResult {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [enabled, refreshMs]);

  return useMemo(() => {
    if (!enabled || schedule.length === 0) {
      return {
        activeAgent: null,
        activeSlot: null,
        nextTransitionAt: null,
      };
    }

    const now = new Date(tick);
    const active = getActiveScheduledAgent(now, schedule);
    const nextTransitionAt = findNextScheduleTransition(now, schedule);
    const activeAgent = AGENTS.find((agent) => agent.slug === active.slot.agentSlug) ?? null;

    return {
      activeAgent,
      activeSlot: active.slot,
      nextTransitionAt,
    };
  }, [enabled, schedule, tick]);
}
