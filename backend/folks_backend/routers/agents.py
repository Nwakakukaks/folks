"""Agent reasoning router for autonomous VJ control."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings

router = APIRouter()

MODEL_NAME = os.getenv("AGENT_REASON_MODEL", "qwen/qwen3-32b")
SCOPE_ENV = os.getenv("SCOPE_ENV", os.getenv("NEXT_PUBLIC_SCOPE_ENV", "prod")).lower()
IS_LOCAL_SCOPE = SCOPE_ENV == "local"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_PROMPT_CHARS = 900
MIN_PROMPT_WORDS = 12
MAX_CONTEXT_CHARS = 24_000
MAX_SKILL_CHARS = 18_000

ALLOWED_MOODS = {
    "calm",
    "groovy",
    "energetic",
    "chaotic",
    "dark",
    "bright",
    "warm",
    "harsh",
}

PREFERRED_PIPELINES = (
    {"longlive"}
    if IS_LOCAL_SCOPE
    else {
        "glitch-realm",
        "crystal-box",
        "morph-host",
        "urban-spray",
        "cosmic-drift",
        "kaleido-scope",
    }
)

EFFECT_VIDEO_COUNT = max(
    1,
    int(
        os.getenv(
            "EFFECT_VIDEO_COUNT",
            os.getenv("NEXT_PUBLIC_EFFECT_VIDEO_COUNT", "5"),
        )
    ),
)


class AudioMetrics(BaseModel):
    bass: float = 0.0
    mids: float = 0.0
    highs: float = 0.0
    overall: float = 0.0
    subBass: float = 0.0
    lowMids: float = 0.0
    upperMids: float = 0.0
    rms: float = 0.0
    peak: float = 0.0
    dynamics: float = 0.0
    beatDetected: bool = False
    beatStrength: float = 0.0
    tempo: float = 0.0
    tempoConfidence: float = 0.0
    mood: str = "calm"
    dominantRange: str = "mids"
    energyCharacter: str = "balanced"


class CurrentState(BaseModel):
    pipeline: str = "passthrough"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    plugins: List[str] = Field(default_factory=list)
    mood: str = "neutral"
    current_effect: int = 1


class AgentScheduleContext(BaseModel):
    slot: Optional[str] = None
    nextTransitionAt: Optional[str] = None


class AgentAnalyzerContext(BaseModel):
    provider: Optional[str] = None
    source: Optional[str] = None


class AgentReasonContext(BaseModel):
    schedule: Optional[AgentScheduleContext] = None
    analyzer: Optional[AgentAnalyzerContext] = None
    pipelines: Optional[List[Dict[str, Any]]] = None


class AgentProfile(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    personality: Optional[Dict[str, Any]] = None
    visualStyle: Optional[Dict[str, Any]] = None
    audioReactivity: Optional[Dict[str, Any]] = None


class AgentAction(BaseModel):
    type: Literal[
        "send_prompt",
        "send_parameters",
        "load_pipeline",
        "install_plugin",
        "configure_ndi",
        "select_effect",
    ]
    params: Optional[Dict[str, Any]] = None
    prompt: Optional[str] = None
    weight: Optional[float] = None
    pipeline_id: Optional[str] = None
    plugin_spec: Optional[str] = None
    ndi_enabled: Optional[bool] = None
    ndi_name: Optional[str] = None
    effect_number: Optional[int] = None


class AgentReasonRequest(BaseModel):
    agent: str
    skill: str = ""
    audio_metrics: AudioMetrics
    current_state: CurrentState
    context: Optional[AgentReasonContext] = None
    agent_profile: Optional[AgentProfile] = None


class AgentReasonResponse(BaseModel):
    thinking: str
    actions: List[AgentAction]
    mood: str
    confidence: float
    caption_text: Optional[str] = None
    caption_styling: Optional[Dict[str, Any]] = None


class CaptionStyling(BaseModel):
    position_preset: str = "center"
    text_align: str = "center"
    font_weight: str = "bold"
    font_size: int = 80
    text_color_r: int = 255
    text_color_g: int = 255
    text_color_b: int = 255
    outline_enabled: bool = True
    outline_width: int = 4
    bg_enabled: bool = False


class CaptionResponse(BaseModel):
    thinking: str
    caption_text: str
    confidence: float
    styling: CaptionStyling = Field(default_factory=CaptionStyling)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def has_min_words(text: str, minimum: int = MIN_PROMPT_WORDS) -> bool:
    return len([w for w in text.split(" ") if w.strip()]) >= minimum


def load_scope_context() -> str:
    context_path = (
        Path(__file__).parent.parent.parent.parent
        / "src"
        / "agents"
        / "SCOPE_CONTEXT.md"
    )
    if context_path.exists():
        return context_path.read_text(encoding="utf-8")
    return ""


def load_skill_for_agent(agent_slug: str) -> str:
    skill_path = (
        Path(__file__).parent.parent.parent.parent
        / "src"
        / "agents"
        / "skills"
        / agent_slug
        / "SKILL.md"
    )
    if skill_path.exists():
        return skill_path.read_text(encoding="utf-8")
    return ""


def build_audio_summary(metrics: AudioMetrics) -> str:
    energy_band = (
        "high"
        if metrics.overall > 0.72
        else "medium"
        if metrics.overall > 0.38
        else "low"
    )
    beat = "yes" if metrics.beatDetected else "no"
    return (
        f"energy={metrics.overall:.3f} ({energy_band}), "
        f"bass={metrics.bass:.3f}, mids={metrics.mids:.3f}, highs={metrics.highs:.3f}, "
        f"beat={beat}, beatStrength={metrics.beatStrength:.3f}, "
        f"tempo={metrics.tempo:.1f}, mood={metrics.mood}, dominantRange={metrics.dominantRange}"
    )


def build_fallback_prompt(metrics: AudioMetrics, mood: str) -> str:
    energy_phrase = (
        "high-intensity kinetic movement"
        if metrics.overall > 0.7
        else "steady rhythmic flow"
        if metrics.overall > 0.4
        else "slow atmospheric drift"
    )
    beat_phrase = (
        "with punchy beat-synced accents"
        if metrics.beatDetected
        else "with smooth continuous transitions"
    )
    color_phrase = (
        "deep neon magenta, cyan highlights, and metallic blue shadows"
        if mood in {"energetic", "chaotic", "bright"}
        else "moody violet gradients, charcoal blacks, and warm amber edge light"
    )
    return (
        f"Cinematic club visual composition with {energy_phrase}, layered volumetric haze, "
        f"polished texture detail, and controlled camera-like motion arcs. Emphasize {color_phrase}, "
        f"preserve strong center focus for stage readability, and evolve forms in cohesive waves {beat_phrase}. "
        f"Blend geometric structures with fluid light trails, maintain premium contrast, and avoid visual clutter."
    )


def build_fallback_caption(metrics: AudioMetrics) -> str:
    if metrics.overall > 0.72:
        return "OH YEAH!!"
    if metrics.beatDetected:
        return "FEEL THE RHYTHM"
    return "STAY IN THE GROOVE"


def build_caption_system_prompt() -> str:
    caption_examples = [
        "\"If you're still standing, you're not dancing enough!!\"",
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
    ]

    return f"""You are a caption generator for a club DJ show.

Your ONLY job is to generate short, punchy captions for a video display. Think of it like signage at a club.

Rules:
1. Generate exactly 3-8 words
2. ALWAYS end with !! or ??
3. Be cheeky, provocative, or funny
4. Match the energy level provided
5. Do NOT generate prompts, actions, or anything else

Examples of good captions:
{chr(10).join(f"  {ex}" for ex in caption_examples)}

Output ONLY this JSON format:
{{"thinking":"brief reason","caption_text":"your 3-8 word caption ending with !! or ??","confidence":0.85}}

Return ONLY the JSON. Nothing else."""


async def caption_reason(request: AgentReasonRequest) -> CaptionResponse:
    """Generate captions using a dedicated caption-focused system."""
    settings = get_settings()

    if not settings.groq_api_key:
        fallback_caption = build_fallback_caption(request.audio_metrics)
        return CaptionResponse(
            thinking="No API key, using fallback",
            caption_text=fallback_caption,
            confidence=0.25,
        )

    agent_slug = request.agent.strip().lower()
    audio_summary = build_audio_summary(request.audio_metrics)

    system_prompt = build_caption_system_prompt()

    user_payload = {
        "energy": request.audio_metrics.overall,
        "beat_detected": request.audio_metrics.beatDetected,
        "mood": request.audio_metrics.mood,
    }

    llm_result = await call_groq(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
        settings.groq_api_key,
    )

    if not llm_result:
        fallback_caption = build_fallback_caption(request.audio_metrics)
        return CaptionResponse(
            thinking="LLM call failed, using fallback",
            caption_text=fallback_caption,
            confidence=0.25,
        )

    try:
        caption_text = str(llm_result.get("caption_text", "")).strip()
        if not caption_text or len(caption_text) < 3:
            caption_text = build_fallback_caption(request.audio_metrics)

        if not (caption_text.endswith("!!") or caption_text.endswith("??")):
            caption_text += "!!"

        thinking = str(llm_result.get("thinking", "")).strip()[:200]
        confidence = float(llm_result.get("confidence", 0.7))
        confidence = clamp(confidence, 0.0, 1.0)

        styling = CaptionStyling(
            position_preset="center",
            text_align="center",
            font_weight="bold",
            font_size=80,
            text_color_r=255,
            text_color_g=255,
            text_color_b=255,
            outline_enabled=True,
            outline_width=4,
            bg_enabled=False,
        )

        return CaptionResponse(
            thinking=thinking or "Caption generated successfully",
            caption_text=caption_text,
            confidence=confidence,
            styling=styling,
        )
    except Exception:
        fallback_caption = build_fallback_caption(request.audio_metrics)
        return CaptionResponse(
            thinking="Parse error, using fallback",
            caption_text=fallback_caption,
            confidence=0.25,
        )


def fallback_response(request: AgentReasonRequest) -> AgentReasonResponse:
    audio = request.audio_metrics
    if audio.overall > 0.72:
        mood = "energetic"
    elif audio.bass > 0.58 and audio.highs < 0.35:
        mood = "dark"
    elif audio.highs > 0.62:
        mood = "bright"
    elif audio.overall < 0.2:
        mood = "calm"
    else:
        mood = "groovy"

    fallback_prompt = build_fallback_prompt(audio, mood)
    fallback_caption = build_fallback_caption(audio)
    fallback_styling = CaptionStyling()

    return AgentReasonResponse(
        thinking="Analyzing the current signal and preparing the next visual move.",
        mood=mood,
        confidence=0.25,
        actions=[
            AgentAction(
                type="send_prompt",
                prompt=fallback_prompt,
                weight=1.0,
            ),
        ],
        caption_text=fallback_caption,
        caption_styling=fallback_styling.model_dump(),
    )


def sanitize_action_payload(action: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    action_type = str(action.get("type", "")).strip()
    if action_type not in {
        "send_prompt",
        "send_parameters",
        "load_pipeline",
        "install_plugin",
        "configure_ndi",
        "select_effect",
    }:
        return None

    if action_type == "send_prompt":
        prompt = " ".join(str(action.get("prompt", "")).split()).strip()[
            :MAX_PROMPT_CHARS
        ]
        if not prompt or len(prompt) < 10:
            return None
        weight = float(action.get("weight", 1.0))
        return {
            "type": action_type,
            "prompt": prompt,
            "weight": clamp(weight, 0.1, 2.0),
        }

    if action_type == "send_parameters":
        params = action.get("params")
        if not isinstance(params, dict) or not params:
            return None
        return {"type": action_type, "params": params}

    if action_type == "load_pipeline":
        pipeline_id = str(action.get("pipeline_id", "")).strip()[:120]
        if not pipeline_id or pipeline_id not in PREFERRED_PIPELINES:
            return None
        return {"type": action_type, "pipeline_id": pipeline_id}

    if action_type == "install_plugin":
        plugin_spec = str(action.get("plugin_spec", "")).strip()[:200]
        if not plugin_spec:
            return None
        return {"type": action_type, "plugin_spec": plugin_spec}

    if action_type == "configure_ndi":
        ndi_name = str(action.get("ndi_name", "")).strip()[:120]
        if not ndi_name:
            return None
        return {
            "type": action_type,
            "ndi_enabled": bool(action.get("ndi_enabled", False)),
            "ndi_name": ndi_name,
        }

    effect_number = int(action.get("effect_number", 1))
    return {
        "type": "select_effect",
        "effect_number": min(EFFECT_VIDEO_COUNT, max(1, effect_number)),
    }


def sanitize_response(
    payload: Dict[str, Any], fallback: AgentReasonResponse
) -> AgentReasonResponse:
    thinking = str(payload.get("thinking", "")).strip()[:600] or fallback.thinking
    mood = str(payload.get("mood", fallback.mood)).lower().strip()
    mood = mood if mood in ALLOWED_MOODS else fallback.mood
    confidence = float(payload.get("confidence", fallback.confidence))
    confidence = clamp(confidence, 0.0, 1.0)

    raw_actions = payload.get("actions", [])
    actions: List[AgentAction] = []
    has_prompt = False
    if isinstance(raw_actions, list):
        for item in raw_actions:
            if not isinstance(item, dict):
                continue
            sanitized = sanitize_action_payload(item)
            if not sanitized:
                continue
            if sanitized["type"] == "send_prompt":
                if has_prompt:
                    continue
                has_prompt = True
            actions.append(AgentAction(**sanitized))

    return AgentReasonResponse(
        thinking=thinking,
        mood=mood,
        confidence=confidence,
        actions=actions,
    )


async def call_groq(
    messages: List[Dict[str, str]], api_key: str
) -> Optional[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=50.0) as client:
        response = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL_NAME,
                "temperature": 0.45,
                "max_tokens": 1400,
                "response_format": {"type": "json_object"},
                "messages": messages,
            },
        )

    if response.status_code != 200:
        print(f"[agents] Groq error {response.status_code}: {response.text[:500]}")
        return None

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            return None
        return json.loads(content)
    except Exception as exc:  # noqa: BLE001
        print(f"[agents] failed to parse Groq content: {exc}")
        return None


@router.post("/reason", response_model=AgentReasonResponse)
async def agent_reason(request: AgentReasonRequest, settings=get_settings()):
    """Agent reasoning endpoint with safe action sanitization."""
    fallback = fallback_response(request)

    if not settings.groq_api_key:
        return fallback

    agent_slug = request.agent.strip().lower()
    skill = request.skill.strip() or load_skill_for_agent(agent_slug)
    scope_context = load_scope_context()
    audio_summary = build_audio_summary(request.audio_metrics)

    print(
        f"[AGENT] {agent_slug.upper()} received audio: overall={request.audio_metrics.overall:.2f}, beat={request.audio_metrics.beatDetected}, tempo={request.audio_metrics.tempo:.0f}, mood={request.audio_metrics.mood}"
    )

    system_prompt = "\n".join(
        [
            "You are a real-time autonomous VJ controller for a premium 24/7 agentic livestream.",
            "Return JSON only. No markdown.",
            "Always include exactly one send_prompt action.",
            "Allowed actions: send_prompt, send_parameters, load_pipeline, install_plugin, configure_ndi, select_effect.",
            "Generate LONG, DETAILED prompts. Target 45-120 words with concrete motion, composition, texture, and color direction.",
            "Use coherent changes and avoid excessive switching.",
            "Prefer these main pipelines when switching: glitch-realm, crystal-box, morph-host, urban-spray, cosmic-drift, kaleido-scope.",
            "Use send_parameters for fine-grained control updates. Caption style should remain bold and centered when captions are updated.",
            "Respect operator cadence: prompts should be less frequent than control tweaks.",
            "Output schema:",
            json.dumps(
                {
                    "thinking": "brief summary of reasoning and chosen actions",
                    "mood": "calm|groovy|energetic|chaotic|dark|bright|warm|harsh",
                    "confidence": 0.75,
                    "actions": [
                        {
                            "type": "send_prompt",
                            "prompt": "long detailed cinematic visual prompt",
                            "weight": 1.0,
                        }
                    ],
                }
            ),
            "",
            "Shared Scope context:",
            scope_context[:MAX_CONTEXT_CHARS],
            "",
            f"Agent skill ({agent_slug}):",
            skill[:MAX_SKILL_CHARS],
        ]
    )

    user_payload = {
        "audio_summary": audio_summary,
        "audio_metrics": request.audio_metrics.model_dump(),
        "current_state": request.current_state.model_dump(),
        "agent_profile": request.agent_profile.model_dump()
        if request.agent_profile
        else {},
        "context": request.context.model_dump() if request.context else {},
    }

    llm_payload = await call_groq(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
        settings.groq_api_key,
    )

    print(
        f"[AGENT] {agent_slug.upper()} raw LLM response: {str(llm_payload)[:500] if llm_payload else 'None'}"
    )

    if not llm_payload:
        print(f"[AGENT] {agent_slug.upper()} LLM call failed, using safety response")
        return fallback

    result = sanitize_response(llm_payload, fallback)
    print(
        f"[AGENT] {agent_slug.upper()} thinking: {result.thinking[:80] if result.thinking else 'N/A'}..."
    )
    print(
        f"[AGENT] {agent_slug.upper()} decided mood={result.mood}, confidence={result.confidence:.2f}, actions={len(result.actions)}"
    )
    for action in result.actions:
        if action.type == "send_prompt" and action.prompt:
            print(
                f"[AGENT] {agent_slug.upper()} >> send_prompt: {action.prompt[:80]}..."
            )
        elif action.type == "select_effect" and action.effect_number:
            print(
                f"[AGENT] {agent_slug.upper()} >> select_effect: {action.effect_number}"
            )
        elif action.type == "send_parameters" and action.params:
            print(
                f"[AGENT] {agent_slug.upper()} >> send_parameters: {list(action.params.keys())}"
            )
        elif action.type == "load_pipeline" and action.pipeline_id:
            print(
                f"[AGENT] {agent_slug.upper()} >> load_pipeline: {action.pipeline_id}"
            )

    caption_result = await caption_reason(request)
    result.caption_text = caption_result.caption_text
    result.caption_styling = caption_result.styling.model_dump()
    print(f"[AGENT] {agent_slug.upper()} >> caption: {caption_result.caption_text}")

    return result


@router.get("/status")
async def agent_status(settings=get_settings()):
    return {
        "available": bool(settings.groq_api_key),
        "provider": "groq",
        "model": MODEL_NAME,
    }


@router.get("/skills/{agent_slug}")
async def get_agent_skill(agent_slug: str):
    """Serve the SKILL.md file for a given agent."""
    skill = load_skill_for_agent(agent_slug.lower())
    if not skill:
        raise HTTPException(status_code=404, detail="Skill file not found")
    return {"content": skill}


@router.post("/caption/reason", response_model=CaptionResponse)
async def agent_caption_reason(request: AgentReasonRequest):
    """Dedicated caption generation endpoint."""
    return await caption_reason(request)
