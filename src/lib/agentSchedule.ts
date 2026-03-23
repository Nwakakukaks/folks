export interface AgentScheduleSlot {
  dayOfWeek: number; // 0=Sunday
  startHour: number; // 0-23
  durationHours: number;
  agentSlug: string;
  label: string;
}

export interface ActiveAgentSchedule {
  slot: AgentScheduleSlot;
  startedAt: Date;
  endsAt: Date;
}

const AGENT_ROTATION = ["echo", "vesper", "riley", "maya", "luna"];

function createDailyRotation(dayOffset: number): AgentScheduleSlot[] {
  const slots: AgentScheduleSlot[] = [];

  for (let hour = 0; hour < 24; hour += 2) {
    const rotationIndex = (Math.floor(hour / 2) + dayOffset) % AGENT_ROTATION.length;
    const agentSlug = AGENT_ROTATION[rotationIndex];

    slots.push({
      dayOfWeek: dayOffset,
      startHour: hour,
      durationHours: 2,
      agentSlug,
      label: `${String(hour).padStart(2, "0")}:00-${String((hour + 2) % 24).padStart(2, "0")}:00`,
    });
  }

  return slots;
}

export const DEFAULT_WEEKLY_AGENT_SCHEDULE: AgentScheduleSlot[] = Array.from({ length: 7 })
  .flatMap((_, dayOfWeek) => createDailyRotation(dayOfWeek));

function toWeekMinutes(date: Date): number {
  return (date.getDay() * 24 * 60) + (date.getHours() * 60) + date.getMinutes();
}

function slotToRangeMinutes(slot: AgentScheduleSlot): { start: number; end: number } {
  const start = slot.dayOfWeek * 24 * 60 + slot.startHour * 60;
  const end = start + slot.durationHours * 60;
  return { start, end };
}

export function getActiveScheduledAgent(
  now: Date,
  schedule: AgentScheduleSlot[] = DEFAULT_WEEKLY_AGENT_SCHEDULE,
): ActiveAgentSchedule {
  const weekMinutes = toWeekMinutes(now);

  let active = schedule[0];
  for (const slot of schedule) {
    const { start, end } = slotToRangeMinutes(slot);
    const inSlot = weekMinutes >= start && weekMinutes < end;
    if (inSlot) {
      active = slot;
      break;
    }
  }

  const activeRange = slotToRangeMinutes(active);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  const startedAt = new Date(weekStart.getTime() + activeRange.start * 60 * 1000);
  const endsAt = new Date(weekStart.getTime() + activeRange.end * 60 * 1000);

  return { slot: active, startedAt, endsAt };
}

export function findNextScheduleTransition(
  now: Date,
  schedule: AgentScheduleSlot[] = DEFAULT_WEEKLY_AGENT_SCHEDULE,
): Date {
  const weekMinutes = toWeekMinutes(now);
  const scheduleStarts = schedule
    .map((slot) => slot.dayOfWeek * 24 * 60 + slot.startHour * 60)
    .sort((a, b) => a - b);

  const nextStart = scheduleStarts.find((minute) => minute > weekMinutes);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  if (nextStart !== undefined) {
    return new Date(weekStart.getTime() + nextStart * 60 * 1000);
  }

  return new Date(weekStart.getTime() + (7 * 24 * 60 + scheduleStarts[0]) * 60 * 1000);
}
