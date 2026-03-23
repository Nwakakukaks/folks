# Agentic VJ 24/7 Setup

## What is implemented

- Continuous scheduled agent handoff (24/7 rotation)
- Agent reasoning API at `/api/agents/reason`
- Safe tool-action execution through `useAgentBrain`
- Audio metrics providers:
  - `webaudio` (built-in FFT analysis)
  - `osc` / `maxmsp` (external bridge over WebSocket)
  - `hybrid` (uses OSC/Max metrics when fresh, otherwise WebAudio)

## Environment variables

```bash
# Required for model reasoning
GROQ_API_KEY=...
# Backward compatible fallback supported:
# NEXT_PUBLIC_GROQ_API_KEY=...

# Optional model override
AGENT_REASON_MODEL=llama-3.3-70b-versatile

# Audio provider: webaudio | osc | maxmsp | hybrid
NEXT_PUBLIC_AUDIO_METRICS_PROVIDER=hybrid

# OSC / Max bridge websocket endpoint
NEXT_PUBLIC_OSC_BRIDGE_WS_URL=ws://127.0.0.1:8765
```

## OSC / Max bridge payload format

The app expects JSON messages over WebSocket. Either direct metric object or wrapped with `metrics`.

### Direct payload

```json
{
  "overall": 0.62,
  "bass": 0.71,
  "mids": 0.44,
  "highs": 0.39,
  "beatDetected": true,
  "beatStrength": 0.8,
  "tempo": 126,
  "tempoConfidence": 0.74,
  "mood": "energetic",
  "dominantRange": "bass",
  "energyCharacter": "driven"
}
```

### Wrapped payload

```json
{
  "type": "audio_metrics",
  "metrics": {
    "overall": 0.31,
    "bass": 0.29,
    "mids": 0.47,
    "highs": 0.54,
    "beatDetected": false,
    "tempo": 98,
    "mood": "bright"
  }
}
```

## Recommended Max/MSP bridge behavior

- Analyze + synth/control in Max
- Emit audio metrics at `8-20 Hz`
- Keep metric values normalized to `0..1` where applicable
- Include `beatDetected`, `tempo`, `mood` when available
- Reconnect automatically if websocket drops

## Runtime behavior

- Agents rotate on schedule slots (`src/lib/agentSchedule.ts`)
- `useAgentSchedule` picks active agent + next transition
- `useAgentBrain` sends schedule + analyzer context to `/api/agents/reason`
- Reasoning result dispatches safe actions to Scope:
  - prompt updates
  - parameter changes
  - pipeline/plugin/NDI operations
  - effect selection
