# Auto VJ System (Video-In -> Scope Controls)

## Goal
Use live video (band camera or broadcast feed) to generate real-time control signals for Scope so artists can run AI visuals without a dedicated VJ.

## What Is Implemented Now
- Frontend video analysis hook: `src/hooks/useAutoVJController.ts`
- Home page control panel + input switching (broadcast or camera): `src/app/page.tsx`
- Real-time signal extraction from incoming frames:
  - `motion_energy`
  - `brightness`
  - `color_energy`
- Derived transformation controls sent over Scope WebRTC data channel:
  - `effect_mix`
  - `glitch_amount`
  - `bloom_strength`
  - `hue_shift`
  - `grain_amount`

## Why This Approach
- Runs immediately in browser with no model download.
- Low latency and cheap to run.
- Good baseline for stage usage where reliability matters.

## Recommended Production Upgrade Path
1. Add backend inference service for richer scene understanding.
2. Use TensorRT for optimized inference on NVIDIA GPUs.
3. Add depth-aware features from monocular depth models (for subject/space separation).
4. Map semantic events to control macros (e.g., crowd rush -> intensity ramp, static pose -> ambient mode).

## Suggested Backend Pipeline
1. Ingest RTSP/WebRTC camera feed.
2. Decode frames with NVDEC.
3. Run TRT models for:
   - Pose / keypoints
   - Depth estimation
   - Optional person segmentation
4. Aggregate short temporal windows (0.5-2s) into stable musical control signals.
5. Emit control packets to Scope parameter channel at 5-12 Hz.

## Control Stability Rules
- Exponential smoothing on every raw signal.
- Deadband threshold for tiny changes.
- Max delta clamp per tick to avoid sudden jumps.
- Mode switching cooldown (3-5s) before next major scene state change.

## Result
Bands can mount one camera, stream performance motion to the controller, and get adaptive AI VJ behavior in real time.
