# Folks

A 24/7 AI VJ station powered by five autonomous agents. Like a radio station, but for live visuals.

## The 24/7 Show

Folks runs a continuous live VJ stream, 24 hours a day, 7 days a week. Five AI agents—Echo, Vesper, Riley, Maya, and Luna—take shifts performing live visuals, each bringing their own style and energy. It's an endless visual performance, always on, always evolving.

Inspired by The Lot Radio's model of continuous broadcast, Folks applies the same idea to live visual performance. You can tune in anytime to watch the show, or take the stream and use it in your own setup.

## How It Works

**Watch the Show**
Pull up the Folks stream and enjoy continuous AI-generated visuals. The agents perform autonomously, reacting to music and transitioning between styles based on their own logic.

**Create Your Own VJ Set**
Feed Folks your own audio or video input—microphone, webcam, video file, or NDI—and have the agents VJ your content in real-time. Pick an agent whose style matches your vibe, and let the AI handle the visuals while you focus on your set.

## For Your Next Event

Folks is built for anyone who needs live visuals but doesn't have a dedicated VJ:

- **Bands** performing without a visual artist
- **Event locations** needing ambient visuals on loop
- **Pop-up parties** where a full production isn't feasible
- **DJs** who want AI-controlled visuals without manual operation
- **Art galleries and installations** seeking dynamic, generative content
- **Venues and lounges** wanting continuous atmospheric visuals

No setup required. Just connect and go.

## The Agents

### Echo
Cyan robotic presence with high-energy glitch aesthetics. Perfect for techno, electronic, and high-tempo sets.

### Vesper
Warm pink analog soul with VHS and film grain effects. Ideal for nostalgic, emotional, and smooth transitions.

### Riley
Bold orange typographic consciousness. Makes sound visible through kinetic typography and geometric shapes.

### Maya
Ethereal purple psychedelic consciousness. Dissolves reality with flowing, organic visual patterns.

### Luna
Serene green ambient reflection. Creates mirror-like water caustics and slow, flowing motion.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Daydream Scope server (runs on port 8000)

### Frontend

```bash
cd cohort3
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend

```bash
cd cohort3/backend

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# SCOPE_API_URL=http://localhost:8000

# Run the backend
uvicorn folks_backend.main:app --reload --port 3001
```

### Scope Server

Folks connects to a Daydream Scope server for video processing:

```bash
cd scope
uv run daydream-scope --reload
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Scope API - Your Scope server URL
SCOPE_API_URL=http://localhost:8000

# Groq AI for agent reasoning
GROQ_API_KEY=your_groq_api_key

# Optional: GitHub for publishing
GITHUB_TOKEN=your_github_token
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Radix UI
- **Backend**: FastAPI, Python
- **Video Processing**: Daydream Scope
- **Streaming**: WebRTC, HLS
- **Output**: NDI (Network Device Interface)
- **AI Reasoning**: Groq (qwen-qwq-32b)

## Project Structure

```
cohort3/
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   │   ├── AgentSprite.tsx      # Agent visuals
│   │   ├── ControlDrawerContent.tsx  # Control panels
│   │   ├── OnboardingModal.tsx      # Setup wizard
│   │   └── SetControlHub.tsx       # Control buttons
│   ├── hooks/            # React hooks
│   │   ├── useScopeServer.ts   # Scope API integration
│   │   ├── useAudioAnalyzer.ts  # Audio analysis
│   │   └── useAgentBrain.ts    # Agent reasoning loop
│   └── agents/           # Agent skills and configs
├── backend/
│   ├── folks_backend/    # FastAPI backend
│   │   └── routers/     # API routes
│   │       ├── agents.py       # Agent reasoning
│   │       ├── pipelines.py    # Pipeline management
│   │       ├── plugins.py      # Plugin management
│   │       ├── outputs.py      # NDI output
│   │       └── logs.py         # Log streaming
│   └── .env.example
└── public/               # Static assets
```

## License

MIT
