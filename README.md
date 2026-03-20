# Folks

AI-powered visual performance platform for live VJing and generative shows. Control real-time AI video processing with intelligent agents that respond to music.

## Overview

Folks is a next-generation visual performance tool that combines AI video processing with an intuitive control system. Five unique AI agents—Echo, Vesper, Riley, Maya, and Luna—each bring their own visual style and personality to transform your shows. Whether you're performing live or creating pre-rendered content, Folks gives you the power of AI-driven visuals at your fingertips.

## Why Folks?

We built Folks for performers who want AI-powered visuals without the complexity. Instead of configuring pipelines and writing code, you pick an agent whose style matches your vibe, connect your audio or video source, and let the AI handle the rest. Real-time, reactive, and beautiful.

## Features

- **5 AI Agents** - Each with unique visual styles, personalities, and audio reactivity
- **Real-time Processing** - Powered by Daydream Scope for low-latency AI video
- **Audio Reactive** - Visuals respond to bass, mids, and highs
- **Multiple Input Sources** - Webcam, microphone, video files, or NDI
- **NDI Output** - Send processed video to any NDI-compatible software
- **Control Panel** - Full control over pipeline, parameters, and output
- **Live Streaming** - Built-in HLS player for preview

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

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Scope API - Your Scope server URL
SCOPE_API_URL=http://localhost:8000

# Optional: Groq AI for future features
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
│   │   └── useScopeServer.ts   # Scope API integration
│   └── agents/           # Agent skills and configs
├── backend/
│   ├── folks_backend/    # FastAPI backend
│   │   └── routers/     # API routes
│   │       ├── pipelines.py   # Pipeline management
│   │       ├── plugins.py      # Plugin management
│   │       ├── outputs.py      # NDI output
│   │       └── logs.py         # Log streaming
│   └── .env.example
└── public/               # Static assets
```

## License

MIT
