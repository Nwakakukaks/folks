import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.AGENT_REASON_MODEL || "llama-3.3-70b-versatile";
const SCOPE_ENV = (process.env.SCOPE_ENV || process.env.NEXT_PUBLIC_SCOPE_ENV || "prod").toLowerCase();
const IS_LOCAL_SCOPE = SCOPE_ENV === "local";
const MAX_SKILL_CHARS = 14_000;
const MAX_CONTEXT_CHARS = 20_000;
const MAX_PROMPT_CHARS = 900;
const MIN_PROMPT_WORDS = 12;
const PREFERRED_PIPELINES = new Set(
  IS_LOCAL_SCOPE
    ? ["longlive"]
    : [
        "glitch-realm",
        "crystal-box",
        "morph-host",
        "urban-spray",
        "cosmic-drift",
        "kaleido-scope",
      ],
);
const EFFECT_VIDEO_COUNT = Math.max(
  1,
  Number(process.env.EFFECT_VIDEO_COUNT || process.env.NEXT_PUBLIC_EFFECT_VIDEO_COUNT || 5),
);

type AllowedMood =
  | "calm"
  | "groovy"
  | "energetic"
  | "chaotic"
  | "dark"
  | "bright"
  | "warm"
  | "harsh";

interface ReasonRequestBody {
  agent?: string;
  skill?: string;
  audio_metrics?: Record<string, unknown>;
  current_state?: {
    pipeline?: string;
    parameters?: Record<string, unknown>;
    plugins?: string[];
    mood?: string;
    current_effect?: number;
  };
  agent_profile?: {
    name?: string;
    slug?: string;
    personality?: Record<string, unknown>;
    visualStyle?: Record<string, unknown>;
    audioReactivity?: Record<string, unknown>;
  };
  context?: {
    schedule?: {
      slot?: string;
      nextTransitionAt?: string;
    };
    analyzer?: {
      provider?: string;
      source?: string;
    };
    pipelines?: Array<{
      id?: string;
      name?: string;
      description?: string;
      controls?: Array<{
        key?: string;
        type?: string;
        description?: string;
        enum?: string[];
        min?: number;
        max?: number;
      }>;
    }>;
  };
}

interface RawAction {
  type?: string;
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
  mood: AllowedMood;
  confidence: number;
  actions: RawAction[];
  caption_text?: string;
  caption_styling?: Record<string, unknown>;
}

const ALLOWED_MOODS: AllowedMood[] = [
  "calm",
  "groovy",
  "energetic",
  "chaotic",
  "dark",
  "bright",
  "warm",
  "harsh",
];

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

function toSafeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function hasMinWords(text: string, minimum = MIN_PROMPT_WORDS): boolean {
  return text.split(" ").filter((word) => word.trim().length > 0).length >= minimum;
}

function pickMood(input: unknown, fallback: AllowedMood = "calm"): AllowedMood {
  if (typeof input !== "string") return fallback;
  const normalized = input.toLowerCase().trim() as AllowedMood;
  return ALLOWED_MOODS.includes(normalized) ? normalized : fallback;
}

function createFallbackResponse(body: ReasonRequestBody): AgentReasonResponse {
  const audio = body.audio_metrics || {};
  const overall = typeof audio.overall === "number" ? clamp(audio.overall) : 0;
  const bass = typeof audio.bass === "number" ? clamp(audio.bass) : 0;
  const highs = typeof audio.highs === "number" ? clamp(audio.highs) : 0;
  const mood: AllowedMood =
    overall > 0.72
      ? "energetic"
      : bass > 0.58 && highs < 0.3
        ? "dark"
        : highs > 0.6
          ? "bright"
          : overall < 0.2
            ? "calm"
            : "groovy";

  const fallbackPrompt =
    mood === "energetic" || mood === "bright"
      ? "Cinematic club visual composition with high-intensity kinetic movement, layered volumetric haze, polished texture detail, and controlled camera-like motion arcs. Emphasize deep neon magenta, cyan highlights, and metallic blue shadows, preserve strong center focus for stage readability, and evolve forms in cohesive beat-synced waves. Blend geometric structures with fluid light trails, maintain premium contrast, and avoid visual clutter."
      : "Cinematic club visual composition with steady rhythmic flow, layered atmospheric depth, polished texture detail, and controlled camera-like motion arcs. Emphasize moody violet gradients, charcoal blacks, and warm amber edge light, preserve strong center focus for stage readability, and evolve forms in cohesive waves with smooth transitions. Blend geometric structures with fluid light trails, maintain premium contrast, and avoid visual clutter.";
  const fallbackCaption =
    overall > 0.72 ? "OH YEAH!!" : (overall > 0.42 ? "FEEL THE RHYTHM" : "STAY IN THE GROOVE");

  return {
    thinking: "Analyzing the current signal and preparing the next visual move.",
    mood,
    confidence: 0.25,
    actions: [
      {
        type: "send_prompt",
        prompt: fallbackPrompt,
        weight: 1,
      },
    ],
    caption_text: fallbackCaption,
    caption_styling: {
      position_preset: "center",
      text_align: "center",
      font_weight: "bold",
      font_size: 80,
      text_color_r: 255,
      text_color_g: 255,
      text_color_b: 255,
      outline_enabled: true,
      outline_width: 4,
      bg_enabled: false,
    },
  };
}

function sanitizeActions(raw: unknown): RawAction[] {
  if (!Array.isArray(raw)) return [];

  const actions: RawAction[] = [];
  let promptCount = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as RawAction;
    const type = typeof candidate.type === "string" ? candidate.type : "";

    if (type === "send_prompt") {
      if (promptCount >= 1) continue;
      if (typeof candidate.prompt !== "string") continue;
      const prompt = candidate.prompt.replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_CHARS);
      if (!prompt || prompt.length < 10) continue;
      promptCount += 1;
      actions.push({
        type,
        prompt,
        weight: typeof candidate.weight === "number" ? clamp(candidate.weight, 0.1, 2) : 1,
      });
      continue;
    }

    if (type === "send_parameters") {
      if (!candidate.params || typeof candidate.params !== "object") continue;
      actions.push({ type, params: candidate.params });
      continue;
    }

    if (type === "load_pipeline" && typeof candidate.pipeline_id === "string") {
      const pipelineId = candidate.pipeline_id.slice(0, 120);
      if (!PREFERRED_PIPELINES.has(pipelineId)) continue;
      actions.push({ type, pipeline_id: pipelineId });
      continue;
    }

    if (type === "install_plugin" && typeof candidate.plugin_spec === "string") {
      actions.push({ type, plugin_spec: candidate.plugin_spec.slice(0, 200) });
      continue;
    }

    if (type === "configure_ndi" && typeof candidate.ndi_name === "string") {
      actions.push({
        type,
        ndi_enabled: Boolean(candidate.ndi_enabled),
        ndi_name: candidate.ndi_name.slice(0, 120),
      });
      continue;
    }

    if (type === "select_effect" && typeof candidate.effect_number === "number") {
      actions.push({
        type,
        effect_number: Math.min(EFFECT_VIDEO_COUNT, Math.max(1, Math.round(candidate.effect_number))),
      });
      continue;
    }
  }

  return actions;
}

function sanitizeResponse(raw: unknown, fallback: AgentReasonResponse): AgentReasonResponse {
  if (!raw || typeof raw !== "object") return fallback;
  const payload = raw as Partial<AgentReasonResponse>;
  const actions = sanitizeActions(payload.actions);

  return {
    thinking:
      typeof payload.thinking === "string" && payload.thinking.trim().length > 0
        ? payload.thinking.slice(0, 400)
        : fallback.thinking,
    mood: pickMood(payload.mood, fallback.mood),
    confidence:
      typeof payload.confidence === "number"
        ? clamp(payload.confidence)
        : fallback.confidence,
    actions,
  };
}

function buildCaptionSystemPrompt(): string {
  const captionExamples = [
    '"If you\'re still standing, you\'re not dancing enough!!"',
    '"This is your sign to move!!"',
    '"Who came here to forget tomorrow?"',
    '"Drink water. Then dance harder."',
    '"That drop was illegal!!"',
    '"You felt that one, didn\'t you?"',
    '"No phones. Just this moment."',
    '"The DJ saw you dancing!!"',
    '"Stay a little longer."',
    '"Same song, different memories."',
    '"Don\'t stop now!!"',
    '"Your vibe is showing."',
    '"This is the good part."',
  ];
  
  return `You are a caption generator for a club DJ show.

Your ONLY job is to generate short, punchy captions for a video display. Think of it like signage at a club.

Rules:
1. Generate exactly 3-8 words
2. ALWAYS end with !! or ??
3. Be cheeky, provocative, or funny
4. Match the energy level provided
5. Do NOT generate prompts, actions, or anything else

Examples of good captions:
${captionExamples.map(ex => `  ${ex}`).join("\n")}

Output ONLY this JSON format:
{"thinking":"brief reason","caption_text":"your 3-8 word caption ending with !! or ??","confidence":0.85}

Return ONLY the JSON. Nothing else.`;
}

async function generateCaption(
  body: ReasonRequestBody,
  GROQ_API_KEY: string
): Promise<{ caption_text: string; caption_styling: Record<string, unknown> }> {
  const audio = body.audio_metrics || {};
  const overall = typeof audio.overall === "number" ? clamp(audio.overall) : 0;
  const fallbackCaption =
    overall > 0.72 ? "OH YEAH!!" : overall > 0.42 ? "FEEL THE RHYTHM" : "STAY IN THE GROOVE";

  const defaultStyling = {
    position_preset: "center",
    text_align: "center",
    font_weight: "bold",
    font_size: 80,
    text_color_r: 255,
    text_color_g: 255,
    text_color_b: 255,
    outline_enabled: true,
    outline_width: 4,
    bg_enabled: false,
  };

  const agentSlug = (body.agent || body.agent_profile?.slug || "echo").toLowerCase();

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildCaptionSystemPrompt() },
          {
            role: "user",
            content: JSON.stringify({
              energy: overall,
              beat_detected: audio.beatDetected,
              mood: audio.mood || "groovy",
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return { caption_text: fallbackCaption, caption_styling: defaultStyling };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return { caption_text: fallbackCaption, caption_styling: defaultStyling };
    }

    const parsed = toSafeJson<unknown>(content);
    if (!parsed || typeof parsed !== "object") {
      return { caption_text: fallbackCaption, caption_styling: defaultStyling };
    }

    const captionPayload = parsed as { caption_text?: unknown; thinking?: unknown };
    let captionText = typeof captionPayload.caption_text === "string" ? captionPayload.caption_text.trim() : "";

    if (!captionText || captionText.length < 3) {
      captionText = fallbackCaption;
    }

    if (!captionText.endsWith("!!") && !captionText.endsWith("??")) {
      captionText += "!!";
    }

    return { caption_text: captionText, caption_styling: defaultStyling };
  } catch {
    return { caption_text: fallbackCaption, caption_styling: defaultStyling };
  }
}

export async function POST(request: NextRequest) {
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json(createFallbackResponse({}), { status: 200 });
    }

    const body = (await request.json()) as ReasonRequestBody;
    const agentSlug = (body.agent || body.agent_profile?.slug || "echo")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "");

    const skillFromBody = typeof body.skill === "string" ? body.skill : "";
    const skillPath = path.join(process.cwd(), "src", "agents", "skills", agentSlug, "SKILL.md");
    const scopeContextPath = path.join(process.cwd(), "src", "agents", "SCOPE_CONTEXT.md");

    const [skillFromFile, scopeContext] = await Promise.all([
      readTextIfExists(skillPath),
      readTextIfExists(scopeContextPath),
    ]);

    const skill = (skillFromBody || skillFromFile).slice(0, MAX_SKILL_CHARS);
    const sharedContext = scopeContext.slice(0, MAX_CONTEXT_CHARS);

    const systemPrompt = [
      "You are a real-time VJ reasoning engine for a 24/7 autonomous agentic livestream.",
      "Return ONLY strict JSON. Do not wrap in markdown.",
      "You must decide prompt + tool actions based on audio metrics, schedule context, and current Scope state.",
      "Always include exactly one send_prompt action.",
      "Generate LONG, DETAILED prompts. Target 45-100 words with concrete motion, composition, texture, color, and camera-like direction.",
      "Allowed actions: send_prompt, send_parameters, load_pipeline, install_plugin, configure_ndi, select_effect.",
      "Prefer subtle, coherent changes over chaotic frequent switching.",
      "Preferred main pipelines for switching: glitch-realm, crystal-box, morph-host, urban-spray, cosmic-drift, kaleido-scope.",
      "When controlling captions through parameters, keep captions bold and centered for readability on stage displays.",
      "If confidence is low, keep changes minimal and avoid expensive actions.",
      "",
      "Output schema:",
      JSON.stringify({
        thinking: "short reasoning summary",
        mood: "calm|groovy|energetic|chaotic|dark|bright|warm|harsh",
        confidence: 0.75,
        actions: [
          {
            type: "send_prompt",
            prompt: "long detailed cinematic visual prompt",
            weight: 1.0,
          },
        ],
      }),
      "",
      "Shared Scope context:",
      sharedContext,
      "",
      `Agent skill (${agentSlug}):`,
      skill,
    ].join("\n");

    const userPrompt = JSON.stringify(
      {
        now: new Date().toISOString(),
        input: body,
        instruction: "Generate next control step for this cycle.",
      },
      null,
      2,
    );

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const fallback = createFallbackResponse(body);

    if (!response.ok) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const parsed = toSafeJson<unknown>(content);
    console.log("[agents/reason] raw LLM response:", JSON.stringify(parsed)?.slice(0, 500));
    const sanitized = sanitizeResponse(parsed, fallback);

    const captionResult = await generateCaption(body, GROQ_API_KEY);
    sanitized.caption_text = captionResult.caption_text;
    sanitized.caption_styling = captionResult.caption_styling;

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("[agents/reason] error:", error);
    return NextResponse.json(createFallbackResponse({}), { status: 200 });
  }
}
