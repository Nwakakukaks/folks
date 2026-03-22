"""Agent reasoning router using Groq LLM for autonomous VJ control."""

import json
from typing import Optional, List, Any
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

from ..config import get_settings

router = APIRouter()


class AudioMetrics(BaseModel):
    """Audio metrics from analysis - supports both simple and rich formats."""
    
    # Legacy fields (optional for backwards compatibility)
    bass: Optional[float] = 0.0
    mids: Optional[float] = 0.0
    highs: Optional[float] = 0.0
    overall: Optional[float] = 0.0
    motion: Optional[float] = 0.0
    beat: Optional[bool] = False
    
    # Rich audio features
    subBass: Optional[float] = 0.0
    lowMids: Optional[float] = 0.0
    upperMids: Optional[float] = 0.0
    
    # Energy metrics
    rms: Optional[float] = 0.0
    peak: Optional[float] = 0.0
    dynamics: Optional[float] = 0.0
    
    # Spectral features
    spectralCentroid: Optional[float] = 0.0
    spectralRolloff: Optional[float] = 0.0
    spectralFlatness: Optional[float] = 0.0
    spectralFlux: Optional[float] = 0.0
    spectralContrast: Optional[float] = 0.0
    
    # Temporal features
    zeroCrossingRate: Optional[float] = 0.0
    transients: Optional[float] = 0.0
    rhythmStability: Optional[float] = 0.0
    
    # Beat detection
    beatDetected: Optional[bool] = False
    beatStrength: Optional[float] = 0.0
    tempo: Optional[float] = 0.0
    tempoConfidence: Optional[float] = 0.0
    
    # Mood/character
    mood: Optional[str] = "calm"
    dominantRange: Optional[str] = "mids"
    energyCharacter: Optional[str] = "balanced"


class CurrentState(BaseModel):
    """Current agent state."""

    pipeline: str
    parameters: dict
    plugins: List[str]
    mood: Optional[str] = None
    current_effect: Optional[int] = 1


class AgentAction(BaseModel):
    """An action the agent wants to take."""

    type: str  # send_parameters, send_prompt, load_pipeline, install_plugin, configure_ndi, select_effect
    params: Optional[dict] = None
    prompt: Optional[str] = None
    weight: Optional[float] = None
    pipeline_id: Optional[str] = None
    plugin_spec: Optional[str] = None
    ndi_enabled: Optional[bool] = None
    ndi_name: Optional[str] = None
    effect_number: Optional[int] = None


class AgentReasonRequest(BaseModel):
    """Request for agent reasoning."""

    agent: str
    skill: str
    audio_metrics: AudioMetrics
    current_state: CurrentState


class AgentReasonResponse(BaseModel):
    """Response from agent reasoning."""

    thinking: str
    actions: List[AgentAction]
    mood: str
    confidence: float


SYSTEM_PROMPT_TEMPLATE = """You are {agent_name}, an autonomous VJ agent running on Daydream Scope.

## Your Identity
{agent_description}

## Your Current State
- Mood: {current_mood}
- Pipeline: {current_pipeline}
- Current Effect: {current_effect}

## Audio Analysis (RICH CONTEXT)
{audio_context}

## Available Actions

1. **send_prompt** - Generate a creative text prompt for the AI video generator
   - This is your PRIMARY action for visual control
   - Create evocative, cinematic prompts that match the audio mood
   - Examples: "neon lights reflecting on wet streets at midnight", "bioluminescent creatures in a dark ocean"
   - weight: 1.0 (fixed for longlive pipeline)

2. **select_effect** - Switch to a different effect video (1-5) and
   - 1: Grid Pulse (geometric grids, rhythmic pulses)
   - 2: Wave Flow (fluid wave motion, organic movement)
   - 3: Particle Storm (particles, explosions, energy bursts)
   - 4: Geometric Drift (floating shapes, dreamy atmosphere)
   - 5: Liquid Motion (liquid dynamics, viscous fluids)

## Effect Video Guide
Match the effect to the audio character:
- High energy, beats → Particle Storm or Wave Flow
- Calm, ambient → Geometric Drift or Liquid Motion
- Rhythmic, structured → Grid Pulse
- Dark, bass-heavy → Particle Storm or Wave Flow
- Bright, highs present → Geometric Drift

## Your SKILL.md (Agent Instructions)

The agent's SKILL.md file contains detailed instructions. READ IT CAREFULLY and follow its guidelines for:
- Prompt generation philosophy
- Style preferences
- Effect selection logic

## Response Format

Return a JSON object with your reasoning and actions:

{{
  "thinking": "Your analysis of the audio and decision process",
  "mood": "The current mood (calm, groovy, energetic, chaotic, dark, bright, warm, harsh)",
  "confidence": 0.0-1.0,
  "actions": [
    {{
      "type": "send_prompt",
      "prompt": "Your creative prompt for the AI video generator"
    }},
    {{
      "type": "select_effect",
      "effect_number": 1-5
    }}
  ]
}}

IMPORTANT: Always include a "send_prompt" action with a creative, evocative prompt that captures the essence of the music.
"""


AGENT_DESCRIPTIONS = {
    "echo": "A precise, rhythmic agent who thrives on beats and basslines. Echo sees the world in patterns and grids, finding order in chaos through repetition and pulse. Perfect for techno, house, and structured electronic music.",
    "vesper": "A dreamy, atmospheric agent who responds to ambience and space. Vesper paints with light and shadow, creating ethereal visuals that breathe with the music. Perfect for ambient, downtempo, and atmospheric soundscapes.",
    "riley": "A chaotic, energetic agent who embraces chaos and intensity. Riley explodes with color and motion, translating high energy into explosive visual storms. Perfect for drum and bass, hardcore, and intense electronic music.",
    "maya": "A fluid, organic agent who flows with the music's natural movement. Maya creates liquid, morphing visuals that feel alive and breathing. Perfect for organic electronic, world music, and flowing compositions.",
    "luna": "A dark, mysterious agent who finds beauty in the shadows. Luna creates deep, atmospheric visuals with subtle details that reveal themselves over time. Perfect for dark techno, industrial, and moody electronic music.",
}


async def call_groq(messages: List[dict], settings) -> tuple[str, str | None]:
    """Call Groq API for reasoning."""
    import httpx

    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "qwen/qwen3-32b",
                    "messages": messages,
                    "temperature": 0.8,
                    "max_completion_tokens": 2048,
                },
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Groq API error: {response.text}",
                )

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # Extract thinking from <think> tags
            reasoning = None
            if "<｜analysis｜>" in content:
                start = content.find("<｜analysis｜>") + len("<｜analysis｜>")
                end = content.find("<｜") if "<｜" in content[start:] else len(content)
                reasoning = content[start:end].strip()
            
            if not reasoning and content:
                reasoning = extract_thinking_from_content(content)

            return content, reasoning

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def extract_thinking_from_content(content: str) -> str | None:
    """Extract thinking from <think>...</think> tags in content."""
    import re

    # Match <think> tags (may span multiple lines)
    pattern = r"<think>(.*?)</think>"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        thinking = match.group(1).strip()
        return thinking
    return None


def remove_thinking_tags(content: str) -> str:
    """Remove <think>...</think> tags from content."""
    import re

    pattern = r"<think>.*?</think>"
    return re.sub(pattern, "", content, flags=re.DOTALL).strip()


def build_audio_context(metrics: AudioMetrics) -> str:
    """Build rich audio context string from metrics."""
    
    # Determine energy level
    overall = metrics.overall or 0.5
    
    # Build frequency band description
    bands = []
    if (metrics.subBass or 0) > 0.6:
        bands.append("deep sub-bass rumble")
    if (metrics.bass or 0) > 0.5:
        bands.append("powerful bass")
    if (metrics.lowMids or 0) > 0.5:
        bands.append("warm low-mids")
    if (metrics.mids or 0) > 0.5:
        bands.append("present midrange")
    if (metrics.upperMids or 0) > 0.5:
        bands.append("crisp upper-mids")
    if (metrics.highs or 0) > 0.5:
        bands.append("sparkling highs")
    elif (metrics.highs or 0) < 0.3:
        bands.append("dark, rolled-off highs")
    
    band_desc = ", ".join(bands) if bands else "balanced frequency distribution"
    
    # Build tempo description
    tempo_desc = "no clear tempo"
    if metrics.tempo and metrics.tempo > 0:
        bpm = int(metrics.tempo)
        confidence = metrics.tempoConfidence or 0
        if confidence > 0.5:
            if bpm < 80:
                tempo_desc = f"slow (~{bpm} BPM)"
            elif bpm < 120:
                tempo_desc = f"moderate (~{bpm} BPM)"
            elif bpm < 150:
                tempo_desc = f"fast (~{bpm} BPM)"
            else:
                tempo_desc = f"very fast (~{bpm} BPM)"
        else:
            tempo_desc = f"approximately {bpm} BPM (uncertain)"
    
    # Build rhythm description
    rhythm_desc = "steady"
    if metrics.beatDetected:
        strength = metrics.beatStrength or 0.5
        if strength > 0.7:
            rhythm_desc = "strong, driving beat"
        elif strength > 0.4:
            rhythm_desc = "moderate beat presence"
        else:
            rhythm_desc = "subtle beat"
    
    # Build spectral character
    flatness = metrics.spectralFlatness or 0.5
    if flatness > 0.6:
        spectral_char = "noisy/textured"
    elif flatness > 0.3:
        spectral_char = "mixed tonal/textured"
    else:
        spectral_char = "pure/tonal"
    
    # Build mood from metrics
    mood = metrics.mood or "balanced"
    
    # Build dynamics description
    dynamics = metrics.dynamics or 1.0
    if dynamics > 3:
        dynamics_desc = "very dynamic (wide variation)"
    elif dynamics > 2:
        dynamics_desc = "dynamic (good variation)"
    elif dynamics > 1.5:
        dynamics_desc = "moderate dynamics"
    else:
        dynamics_desc = "compressed (steady level)"
    
    # Dominant frequency range
    dominant = metrics.dominantRange or "mids"
    dominant_desc = {
        "subBass": "sub-bass frequencies dominate",
        "bass": "bass frequencies dominate",
        "lowMids": "low-mid frequencies dominate",
        "mids": "mid frequencies dominate",
        "upperMids": "upper-mid frequencies dominate",
        "highs": "high frequencies dominate",
    }.get(dominant, "balanced frequency content")
    
    # Transients
    transients = metrics.transients or 0
    if transients > 0.5:
        transient_desc = "sharp transients, punchy attacks"
    elif transients > 0.2:
        transient_desc = "moderate transient content"
    else:
        transient_desc = "smooth, sustained sound"
    
    return f"""### Audio Character
- Energy Level: {"high" if overall > 0.7 else "medium" if overall > 0.4 else "low"} ({overall:.0%})
- Frequency Character: {band_desc}
- Tempo: {tempo_desc}
- Rhythm: {rhythm_desc}
- Dynamics: {dynamics_desc}
- Spectral Character: {spectral_char}
- Transient Response: {transient_desc}
- Dominant Range: {dominant_desc}
- Mood Classification: {mood}
- Beat Strength: {metrics.beatStrength:.0%} if metrics.beatStrength else "N/A"""


@router.post("/reason", response_model=AgentReasonResponse)
async def agent_reason(request: AgentReasonRequest, settings=get_settings()):
    """Have an agent reason about what actions to take based on audio metrics."""

    agent_name = request.agent.capitalize()
    agent_desc = AGENT_DESCRIPTIONS.get(
        request.agent.lower(), "An autonomous VJ agent."
    )

    # Build rich audio context
    audio_context = build_audio_context(request.audio_metrics)

    # Build context
    context = {
        "agent_name": agent_name,
        "agent_description": agent_desc,
        "current_mood": request.current_state.mood or "neutral",
        "current_pipeline": request.current_state.pipeline,
        "current_effect": request.current_state.current_effect or 1,
        "audio_context": audio_context,
    }

    prompt = SYSTEM_PROMPT_TEMPLATE.format(**context)

    # Include agent's skill file for guidance
    if request.skill:
        prompt += f"\n\n## YOUR SKILL.md\n\n{request.skill}"

    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": "Analyze the audio and decide what action to take.",
        },
    ]

    response_content, reasoning = await call_groq(messages, settings)

    # Log the reasoning for debugging
    if reasoning:
        print(
            f"[AGENT {agent_name}] Thinking: {reasoning[:500]}..."
        )  # Log first 500 chars

    # Parse JSON response
    try:
        # Remove <think> tags from content if present
        clean_content = remove_thinking_tags(response_content)

        # Find JSON in response
        start = clean_content.find("{")
        end = clean_content.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(clean_content[start:end])

            # Use the LLM's thinking, or the extracted reasoning, or fallback
            thinking = result.get("thinking") or reasoning or "No thinking provided"

            return AgentReasonResponse(
                thinking=thinking,
                actions=[AgentAction(**a) for a in result.get("actions", [])],
                mood=result.get("mood", "neutral"),
                confidence=result.get("confidence", 0.5),
            )
    except json.JSONDecodeError as e:
        print(f"[AGENT {agent_name}] JSON parse error: {e}")
        print(f"[AGENT {agent_name}] Raw response: {response_content[:500]}")

    # Fallback response
    return AgentReasonResponse(
        thinking=reasoning or "Could not parse LLM response",
        actions=[],
        mood="neutral",
        confidence=0.0,
    )


@router.get("/status")
async def agent_status(settings=get_settings()):
    """Check agent system status."""
    return {
        "available": bool(settings.groq_api_key),
        "provider": "groq",
        "model": "qwen/qwen3-32b",
    }
