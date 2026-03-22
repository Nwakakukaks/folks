export type SkillAbility =
  | "control_parameters"
  | "control_pipeline"
  | "control_plugins"
  | "configure_output";

export interface SkillControlAction {
  type: "send_parameters" | "load_pipeline" | "install_plugin" | "configure_ndi";
  params?: Record<string, unknown>;
  pipeline_id?: string;
  plugin_spec?: string;
  ndi_enabled?: boolean;
  ndi_name?: string;
}

export interface SkillControlMap {
  slug: string;
  abilities: Set<SkillAbility>;
  preferredParams: Record<string, { min: number; max: number }>;
  rawSkill: string;
}

const DEFAULT_ABILITIES: SkillAbility[] = [
  "control_parameters",
  "control_pipeline",
  "control_plugins",
  "configure_output",
];

export function buildSkillControlMap(slug: string, skillMarkdown: string): SkillControlMap {
  const abilities = new Set<SkillAbility>(DEFAULT_ABILITIES);
  const preferredParams: Record<string, { min: number; max: number }> = {};

  const frontmatter = skillMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatter) {
    const abilityMatches = frontmatter[1].match(/abilities:\s*([\s\S]*?)(\n\w|$)/);
    if (abilityMatches) {
      const parsed = Array.from(abilityMatches[1].matchAll(/-\s*([a-z_]+)/g))
        .map((m) => m[1] as SkillAbility)
        .filter((ability) => DEFAULT_ABILITIES.includes(ability));
      if (parsed.length > 0) {
        abilities.clear();
        parsed.forEach((ability) => abilities.add(ability));
      }
    }
  }

  for (const line of skillMarkdown.split("\n")) {
    const match = line.match(/`([\w.-]+)`:\s*([0-9.-]+)\s*-\s*([0-9.-]+)/);
    if (!match) continue;
    const min = Number(match[2]);
    const max = Number(match[3]);
    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      preferredParams[match[1]] = { min, max };
    }
  }

  return {
    slug,
    abilities,
    preferredParams,
    rawSkill: skillMarkdown,
  };
}

export function normalizeActionForSkill(
  action: SkillControlAction,
  controlMap: SkillControlMap,
  availablePipelines: string[],
): SkillControlAction | null {
  if (action.type === "send_parameters") {
    if (!controlMap.abilities.has("control_parameters")) return null;
    if (!action.params) return null;
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(action.params)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        normalized[key] = value;
        continue;
      }
      const range = controlMap.preferredParams[key];
      if (!range) {
        normalized[key] = value;
        continue;
      }
      normalized[key] = Math.min(range.max, Math.max(range.min, value));
    }
    return { ...action, params: normalized };
  }

  if (action.type === "load_pipeline") {
    if (!controlMap.abilities.has("control_pipeline")) return null;
    if (!action.pipeline_id) return null;
    if (availablePipelines.length > 0 && !availablePipelines.includes(action.pipeline_id)) {
      return null;
    }
    return action;
  }

  if (action.type === "install_plugin") {
    if (!controlMap.abilities.has("control_plugins")) return null;
    if (!action.plugin_spec) return null;
    return action;
  }

  if (action.type === "configure_ndi") {
    if (!controlMap.abilities.has("configure_output")) return null;
    if (typeof action.ndi_enabled !== "boolean" || !action.ndi_name) return null;
    return action;
  }

  return null;
}
