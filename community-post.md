Folks: Building a 24/7 AI VJ Show

I wanted to test a simple idea: can an autonomous visual system hold attention for long periods, the same way a good radio station does?

That question became Folks.
It is a 24/7 AI VJ broadcast where multiple agents take scheduled shifts, listen to incoming audio, and control live visuals in real time.

How it works

1. Receive audio input (audio/video sources)
2. Run real-time audio analysis (bands, RMS/peak, beat detection, tempo, transients, spectral features)
3. Feed analysis + current state + agent skill context into a reasoning model
4. Execute tool actions against Scope (pipeline switching, parameter updates, prompt updates, captions)
5. Stream the visual output continuously

The important detail is that reasoning does not run in isolation.
Each cycle includes:

1. current pipeline
2. current parameters
3. available controls from pipeline schema
4. currently active agent
5. schedule context (handoff timing)
6. fresh audio metrics

That gives the model enough context to make controlled decisions.

Technical Setup

The system is split into three layers:

1. Frontend control and stream surfaces

- Home page: public live view
- App page: operator view with controls, logs, runtime panel, and agent tools
- Input handling: HLS plus file/external audio workflows
- Audio gating: stream/effect animation only advances when audio is actually active and analyzed

The UI reads each active pipeline schema and renders matching controls dynamically (toggles, sliders, selects, numeric fields).
So when a pipeline changes, controls update automatically without hardcoding per pipeline.

2. Agent runtime and orchestration

- Agent scheduling picks who is active per slot
- Agent brain enforces cadence windows (prompt interval vs control interval)
- User overrides are temporary; agent resumes quickly
- Actions are logged with timestamps and agent identity

We separated agent intention from execution rate.
That protects stream stability, prevents over-triggering, and keeps visuals coherent.

3. Backend reasoning + Scope execution

- Reasoning endpoint receives audio + context + skill docs
- Model returns structured actions (send_prompt, send_parameters, load_pipeline, select_effect, etc.)
- Action payloads are validated/sanitized before execution
- Scope receives clean parameter updates and pipeline load requests

Captions are treated as a first-class control channel, not an afterthought.
They are updated through explicit caption fields and rendered as stage-readable overlays.

Pipelines and Visual Language

Current main pipelines:

1. glitch-realm
2. crystal-box
3. morph-host
4. urban-spray
5. cosmic-drift
6. kaleido-scope

Each pipeline exposes a different control vocabulary.
Agents can switch pipelines and then work with the new schema.

Current Status

Today, the system can:

1. run continuously with scheduled agent handoffs
2. react to live audio in real time
3. switch pipelines/effects and tune parameters autonomously
4. render caption overlays from agent outputs
5. let an operator override briefly without breaking agent continuity

Credits

The caption system uses Wallspace Captions by Jack Morgan. We're just plugging into it. Check out his work if you need text overlays for Scope.

Future work

Audio and Video Intelligence

Right now the system is audio-driven. Agents listen to incoming audio and make decisions from that signal alone.

The next step is adding real-time video analysis alongside audio. Agents would be able to:

1. Watch a live video feed and understand what's happening in the frame
2. Reason about visual content the same way they reason about audio
3. Make autonomous decisions based on both signals together

A practical example: a live band points a camera at their performance and the agents do the VJ. They watch the guitar player, the drummer, the crowd. Read the energy from the video and pair that with the audio to steer the visuals.

This is not just audio-reactive anymore. It is vision-aware.

Output and Visuals

1. Stronger audio-semantic mapping (better movement/color decisions from signal shape)
2. Better long-horizon composition planning (multi-minute visual arcs, not just local reactions)
3. Richer post-processing stack (caption treatments, compositing tools, transitions)
4. Expanded visual toolkit (more detailed effects, better textures)
5. Better operator analytics around action quality and stability over long sessions

If You Are Building Something Similar

If you are working on autonomous media systems, live AI tooling, or agentic creative software, I would love to compare notes!
