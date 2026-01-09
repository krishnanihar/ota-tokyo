# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Elemental Bender** is an interactive body-tracking installation inspired by Avatar: The Last Airbender. Users see their semi-transparent black silhouette with elemental energy flowing inside their body. The visual style blends modern particle effects with traditional Japanese ukiyo-e woodblock print aesthetics.

See `ELEMENTAL_BENDER_SPEC.md` for the full design specification.

## Development Commands

All commands run from the `elemental-bender/` directory:

```bash
cd elemental-bender
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000 (opens browser)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

**Note:** Requires webcam access. The app will prompt for camera permissions.

## Architecture

### Core Systems (src/core/)
- **App.js** - Main orchestrator that initializes all systems, runs the animation loop, and coordinates state between detection, rendering, and particle systems
- **InputManager.js** - Keyboard input handling (debug, mirror, mode switching)

### Detection (src/detection/)
- **MediaPipeSetup.js** - Initializes MediaPipe Pose Landmarker with GPU delegate, handles webcam setup
- **PoseProcessor.js** - Converts raw MediaPipe landmarks to normalized pose data with velocity calculation
- **SegmentationMask.js** - Processes the body segmentation mask from MediaPipe

### Rendering (src/rendering/)
- **SceneSetup.js** - Three.js scene with WebGL2 (WebGPU disabled for ShaderMaterial compatibility). Includes post-processing with AfterimagePass, metaball shader, and UnrealBloomPass
- **BodyRenderer.js** - Renders filled body silhouette using segmentation mask (currently hidden, kept as fallback)
- **PointCloudBodyRenderer.js** - Active body renderer using point cloud particles for stylized silhouette
- **HandRenderer.js** - Renders elemental orbs at hand positions

### Systems (src/systems/)
- **ParticleSystem.js** - Legacy CPU particle system with object pooling
- **GPUParticleSystem.js** - WebGPU compute shader particle system (used when WebGPU available)
- **ChargeSystem.js** - Tracks stillness time and calculates charge level (NONE→SPARK→FORM→POWER→AVATAR)
- **CycleSystem.js** - Manages automatic element rotation every 10 seconds

### Elements (src/elements/)
Each element extends ElementBase and implements element-specific particle behaviors:
- **FireElement.js** - Particles flow upward, fast/volatile
- **WaterElement.js** - Particles flow downward, Hokusai wave style
- **EarthElement.js** - Particles settle toward center, slow/heavy
- **AirElement.js** - Particles swirl constantly, fast scatter

## Key Configuration (src/config.js)

```javascript
// Movement thresholds for charge detection
STILLNESS_THRESHOLD: 0.005   // Below = charging
SLOW_MOVE_THRESHOLD: 0.03    // Below = flowing trails
FAST_MOVE_THRESHOLD: 0.08    // Above = projectile release

// Charge levels by stillness duration (seconds)
SPARK: 0-2s, FORM: 2-5s, POWER: 5-8s, AVATAR: 8+s

// Element cycle: 10 seconds per element
ELEMENT_ORDER: ['fire', 'water', 'earth', 'air']
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `1` | Training mode |
| `2` | Sandbox mode |
| `3-6` | Force element (Fire/Water/Earth/Air) |
| `Space` | Skip to next element |
| `D` | Toggle debug overlay |
| `F` | Toggle fullscreen |
| `M` | Toggle mirror mode |

## Render Pipeline

1. MediaPipe detects pose landmarks + segmentation mask at 30fps
2. PoseProcessor calculates movement velocity from key joints
3. ChargeSystem determines charge level from stillness duration
4. ParticleSystem spawns/updates particles based on charge and element
5. SceneSetup renders with post-processing: Afterimage → Metaball shader → Bloom → Output

## Color Palette (Ukiyo-e style)

Each element has `primary`, `secondary`, `accent`, and `glow` colors defined in `COLORS` object:
- Fire: Vermillion (#E34234) / Gold Ochre (#CFB53B)
- Water: Prussian Blue (#1a4c7c) / Mid Blue (#2d6a9f)
- Earth: Raw Umber (#806517) / Warm Grey (#8B8378)
- Air: Silver Mist (#C0C0C0) / Cloud White (#F0EAD6)

## Future Work

See `elemental-bender/IMPLEMENTATION_PLAN_V2.md` for planned WebGPU migration with TSL compute shaders, curl noise flow fields, and metaball post-processing.
