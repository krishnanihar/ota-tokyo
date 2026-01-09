# THE ELEMENTAL BENDER
## Ukiyo-e Style Interactive Installation — Technical Specification

---

## Overview

An interactive body-tracking installation where users become elemental benders (Avatar: The Last Airbender inspired). The visual style blends modern particle effects with traditional Japanese ukiyo-e woodblock print aesthetics — brush stroke textures, hand-drawn quality, and colors inspired by Hokusai, Hiroshige, and Rinpa school paintings.

### Installation Setup

```
┌─────────────────────────┐
│      LARGE DISPLAY      │  ← Fullscreen Chrome
│    (1080p or higher)    │
└─────────────────────────┘
            │
       2-4 meters
            │
      ┌─────────┐
      │  USER   │  ← Faces display
      └─────────┘
            │
      ┌─────────┐
      │ CAMERA  │  ← Wide-angle webcam
      └─────────┘
```

---

## Core Experience

Users see their **semi-transparent black silhouette** with **elemental energy flowing inside their body**. Elements form in their hands and respond to movement:

- **Stand still** → Charge energy (DBZ-style aura builds)
- **Move slowly** → Energy flows with you as trails
- **Move fast** → Energy releases as projectile with trails
- **Elements auto-cycle** every 30 seconds

---

## Technology Stack

### Required
- **MediaPipe Tasks Vision** — Pose landmarks (33 points) + Segmentation mask
- **HTML5 Canvas** or **Three.js WebGPU** — Rendering
- **Web Audio API** — Sound effects and ambient audio

### MediaPipe Setup
```javascript
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'pose_landmarker_lite.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1,
  outputSegmentationMasks: true
});
```

---

## Element Cycle System

### Rotation
```
🔥 FIRE (30s) → 🌊 WATER (30s) → 🪨 EARTH (30s) → 🌀 AIR (30s) → repeat
```

### Transitions
- **Duration:** 3 seconds smooth blend
- **Visual cue:** Current element fades, new element particles emerge
- **Audio cue:** Whoosh/sweep sound + new element ambient begins

---

## The Four Elements

### 🔥 FIRE — Edo Fire Scroll Style

| Property | Value |
|----------|-------|
| **Art Reference** | Buddhist flame halos, Fudō Myōō paintings, festival lantern art |
| **Primary Color** | `#E34234` Vermillion |
| **Secondary Color** | `#CFB53B` Gold Ochre |
| **Accent Color** | `#1C1C1C` Soot Black |

| Behavior | Description |
|----------|-------------|
| **Hand Form** | Flames licking upward from palms, flickering |
| **Body Infusion** | Fire flows UPWARD inside silhouette |
| **Charge Aura** | Flame tongues rise around entire body |
| **Movement Trail** | Comet tail effect, scattered gold leaf embers |
| **Fast Release** | Burst shoots forward, ember explosion |
| **Environment** | Ground cracks glow orange, floating embers rise |
| **Speed** | Fast, volatile |
| **Decay** | Quick burn-out |

### 🌊 WATER — Hokusai Wave Style

| Property | Value |
|----------|-------|
| **Art Reference** | The Great Wave off Kanagawa, Hiroshige rain scenes |
| **Primary Color** | `#003153` Prussian Blue |
| **Secondary Color** | `#264653` Indigo |
| **Accent Color** | `#F5F5F5` Foam White |

| Behavior | Description |
|----------|-------------|
| **Hand Form** | Swirling water sphere with Hokusai wave curl edges, foam dots |
| **Body Infusion** | Water flows DOWNWARD inside silhouette |
| **Charge Aura** | Rings of water orbit body, mist rises from ground |
| **Movement Trail** | Silk ribbon-like flow, foam spray particles |
| **Fast Release** | Wave crashes outward with iconic curl pattern |
| **Environment** | Rain drops falling, ripple effects on ground, caustic light |
| **Speed** | Medium, fluid |
| **Decay** | Flowing dissipation |

### 🪨 EARTH — Sumi-e Ink Wash Style

| Property | Value |
|----------|-------|
| **Art Reference** | Sesshu landscapes, Zen rock gardens, ink splash paintings |
| **Primary Color** | `#806517` Raw Umber |
| **Secondary Color** | `#8B8378` Warm Grey |
| **Accent Color** | `#8A9A5B` Moss Green |

| Behavior | Description |
|----------|-------------|
| **Hand Form** | Rocks and debris orbit palms, gritty particles |
| **Body Infusion** | Dense particles settle toward body's core/center |
| **Charge Aura** | Ground cracks spread, pebbles levitate around feet and body |
| **Movement Trail** | Heavy chunks follow slowly, dust cloud lingers |
| **Fast Release** | Boulder chunks shoot out, shatter on invisible impact |
| **Environment** | Floating rocks, seismic crack patterns spread on ground |
| **Speed** | Slow, deliberate, weighty |
| **Decay** | Lingers longest of all elements |

### 🌀 AIR — Rinpa Cloud Style

| Property | Value |
|----------|-------|
| **Art Reference** | Kōrin cloud screens, Wind God paintings, gold leaf clouds |
| **Primary Color** | `#C0C0C0` Silver Mist |
| **Secondary Color** | `#F0EAD6` Cloud White |
| **Accent Color** | `#EEE8AA` Pale Gold |

| Behavior | Description |
|----------|-------------|
| **Hand Form** | Spiral vortex in palms, leaves/petals caught in mini cyclone |
| **Body Infusion** | Swirling energy constantly in motion, never settles |
| **Charge Aura** | Full cyclone forms around body, debris caught in wind |
| **Movement Trail** | Wind streaks, particles scatter in all directions |
| **Fast Release** | Expanding gust wave, wide spread, pushes all particles |
| **Environment** | Cherry blossom petals, autumn leaves (momiji), mist swirls |
| **Speed** | Instant, weightless |
| **Decay** | Quick scatter in all directions |

---

## Charge System — 4 Levels

Charge builds when user stands still. Measured by movement velocity threshold.

### Level 1: SPARK (0-2 seconds still)
```
Hands:       Faint glow, tiny particles forming
Body:        Subtle color tint on silhouette edges
Environment: Pure black, nothing yet
Release:     Small puff, minimal trail
```

### Level 2: FORM (2-5 seconds still)
```
Hands:       Element visibly forming (flames/water/rocks/spiral)
Body:        Energy flow visible inside silhouette
Environment: First particles appear in background
Release:     Medium trail, visible element projection
```

### Level 3: POWER (5-8 seconds still)
```
Hands:       Full element manifestation, intense glow
Body:        Strong internal glow, aura surrounds body
Environment: Full theme active (embers/rain/debris/leaves)
Release:     Strong trail, environment reacts to release
```

### Level 4: AVATAR STATE (8+ seconds still)
```
Hands:       Overflowing energy, unstable, can barely contain
Body:        Eyes glow white, full elemental transformation
Environment: Maximum intensity, particles everywhere
Screen:      Subtle shake, chromatic aberration effect
Release:     Massive discharge, screen flash, epic trails
```

### Release Mechanics
- **Trigger:** Automatic on movement (no gesture required)
- **Slow movement:** Energy flows with user as continuous trail
- **Fast movement:** Projectile releases in direction of movement
- **Release size:** Proportional to charge level achieved

---

## Body Visualization

### Silhouette Style: Semi-transparent with energy inside

```
         ∴∴∴
       ∴≋≋≋≋≋∴
      ∴≋≋≋≋≋≋≋∴     ← Black silhouette outline
      ∴≋≋≋≋≋≋≋∴        with element energy
       ∴≋≋≋≋≋∴          visible INSIDE body
        ∴≋≋≋∴
        ∴   ∴
```

### Implementation
1. **Segmentation mask** from MediaPipe defines body boundary
2. **Black fill** with ~70% opacity for silhouette
3. **Element particles** render INSIDE mask boundary only
4. **Glow edges** in element color around silhouette border
5. **Energy flows** based on element:
   - Fire: particles flow upward inside body
   - Water: particles flow downward inside body
   - Earth: particles gravitate toward center/core
   - Air: particles swirl constantly, never settle

---

## Visual Layers (Render Order)

```
TOP
 │
 ├── Layer 5: UI (Training mode text only)
 │
 ├── Layer 4: Screen Effects (flash, shake, chromatic aberration)
 │
 ├── Layer 3: Environment Particles (embers/rain/rocks/leaves)
 │
 ├── Layer 2: Body + Hands (silhouette with internal energy + hand elements)
 │
 ├── Layer 1: Background (black → element-themed gradient at high intensity)
 │
 └── Layer 0: Paper Texture (washi grain overlay, 5-10% opacity)
 │
BOTTOM
```

---

## Ukiyo-e Visual Style

### Brush Stroke Particles
Every particle should feel hand-drawn:
- Use **brush stroke sprites** instead of circles
- **Vary rotation** for organic feel
- **Soft alpha edges** like ink bleeding on paper
- **Slight wobble** in movement, not perfectly smooth

### Paper Texture Overlay
- Subtle **washi paper grain** over entire screen
- **5-10% opacity** — should be felt, not seen
- Adds warmth, breaks digital perfection

### Line Work
Key shapes get visible outlines:
- **Wave curls** (water) — Hokusai-style bold curves
- **Flame edges** (fire) — Sharp, licking shapes
- **Rock facets** (earth) — Angular ink brush strokes
- **Wind swirls** (air) — Flowing calligraphic curves

### Color Palette (Full Reference)
```css
:root {
  /* Fire */
  --fire-primary: #E34234;    /* Vermillion */
  --fire-secondary: #CFB53B;  /* Gold Ochre */
  --fire-accent: #1C1C1C;     /* Soot Black */
  
  /* Water */
  --water-primary: #003153;   /* Prussian Blue */
  --water-secondary: #264653; /* Indigo */
  --water-accent: #F5F5F5;    /* Foam White */
  
  /* Earth */
  --earth-primary: #806517;   /* Raw Umber */
  --earth-secondary: #8B8378; /* Warm Grey */
  --earth-accent: #8A9A5B;    /* Moss Green */
  
  /* Air */
  --air-primary: #C0C0C0;     /* Silver Mist */
  --air-secondary: #F0EAD6;   /* Cloud White */
  --air-accent: #EEE8AA;      /* Pale Gold */
  
  /* Universal */
  --background: #0A0A0A;      /* Near black */
  --energy-white: #FFFEF0;    /* Warm white for glows */
}
```

---

## Audio Design

### Ambient Loops (per element)
| Element | Ambient Sound |
|---------|---------------|
| Fire | Crackling flames, low roar, occasional pop |
| Water | Flowing stream, gentle rain, droplets |
| Earth | Deep rumble, settling stones, distant thunder |
| Air | Wind howl, soft chimes, rustling leaves |

### Sound Effects
| Event | Sound |
|-------|-------|
| Charge building | Rising hum, increases with level |
| Level up (1→2→3→4) | Subtle power-up chime |
| Release (slow) | Soft whoosh |
| Release (fast) | Sharp burst + element-specific impact |
| Element transition | Ethereal sweep + fade out/fade in |
| Avatar State reached | Epic swell, power surge, rumble |

### Implementation
- Use **Web Audio API**
- **Crossfade** ambient tracks during element transitions
- **Layer** multiple sounds for richness
- **Spatial audio** optional — sounds follow particle positions

---

## Application Modes

### Mode 1: Training
Interactive tutorial with 5 lessons.

```
LESSON 1: "Stand still to gather energy"
├── Ghost silhouette demonstrates standing pose
├── Text overlay explains charging
└── Success when user reaches Level 2 charge

LESSON 2: "Move to release your power"
├── Ghost shows movement
├── Text explains automatic release
└── Success when user releases energy

LESSON 3: "Move slowly — energy flows with you"
├── Ghost demonstrates slow, controlled movement
├── Text explains trail effect
└── Success when user creates flowing trail

LESSON 4: "Move fast — launch your element"
├── Ghost shows fast punch/push motion
├── Text explains projectile release
└── Success when user launches projectile

LESSON 5: "Experience all four elements"
├── Forced quick cycle (10 sec each element)
├── Text introduces each element's personality
└── Complete when all four experienced
```

**UI Elements:**
- Text prompts: Center-top of screen, clean sans-serif font
- Ghost silhouette: White outline showing target pose
- Progress indicator: Subtle dots or bar

### Mode 2: Sandbox
Pure creative expression.

```
- NO UI elements
- Pure black background
- Auto-cycle elements every 30 seconds
- Full particle/environment effects
- Audio ambient + SFX active
```

### Mode Selection
- **UI control** for testing (buttons or keyboard)
- Keyboard shortcuts:
  - `1` — Training mode
  - `2` — Sandbox mode
  - `D` — Toggle debug info
  - `F` — Fullscreen
  - `M` — Toggle mirror mode

---

## Technical Implementation Notes

### Movement Velocity Calculation
```javascript
function calculateMovementVelocity(previousPose, currentPose) {
  const keyJoints = [0, 11, 12, 15, 16, 23, 24]; // nose, shoulders, wrists, hips
  let totalVelocity = 0;
  
  keyJoints.forEach(i => {
    const dx = currentPose[i].x - previousPose[i].x;
    const dy = currentPose[i].y - previousPose[i].y;
    totalVelocity += Math.sqrt(dx * dx + dy * dy);
  });
  
  return totalVelocity / keyJoints.length;
}

// Thresholds
const STILLNESS_THRESHOLD = 0.005;  // Below this = charging
const SLOW_MOVE_THRESHOLD = 0.03;   // Below this = flowing
const FAST_MOVE_THRESHOLD = 0.08;   // Above this = projectile
```

### Charge State Machine
```javascript
const ChargeState = {
  NONE: 0,
  SPARK: 1,      // 0-2 sec
  FORM: 2,       // 2-5 sec
  POWER: 3,      // 5-8 sec
  AVATAR: 4      // 8+ sec
};

// Update each frame
if (movementVelocity < STILLNESS_THRESHOLD) {
  stillTime += deltaTime;
} else {
  // Movement detected — release based on charge level
  releaseEnergy(chargeLevel, movementVelocity);
  stillTime = 0;
}

// Determine charge level from still time
if (stillTime > 8) chargeLevel = ChargeState.AVATAR;
else if (stillTime > 5) chargeLevel = ChargeState.POWER;
else if (stillTime > 2) chargeLevel = ChargeState.FORM;
else if (stillTime > 0) chargeLevel = ChargeState.SPARK;
else chargeLevel = ChargeState.NONE;
```

### Element Cycle Timer
```javascript
const ELEMENT_DURATION = 30000; // 30 seconds
const TRANSITION_DURATION = 3000; // 3 seconds

const elements = ['fire', 'water', 'earth', 'air'];
let currentElementIndex = 0;
let elementTimer = 0;
let isTransitioning = false;

function updateElementCycle(deltaTime) {
  elementTimer += deltaTime;
  
  if (elementTimer > ELEMENT_DURATION - TRANSITION_DURATION && !isTransitioning) {
    isTransitioning = true;
    startTransition(elements[currentElementIndex], elements[(currentElementIndex + 1) % 4]);
  }
  
  if (elementTimer > ELEMENT_DURATION) {
    currentElementIndex = (currentElementIndex + 1) % 4;
    elementTimer = 0;
    isTransitioning = false;
  }
}
```

### Particle Inside Body (Mask-based rendering)
```javascript
// Option 1: Canvas clip path
ctx.save();
ctx.clip(segmentationMaskPath);
// Render particles here — only visible inside mask
renderElementParticles();
ctx.restore();

// Option 2: Check each particle against mask
particles.forEach(p => {
  const maskValue = getMaskValueAt(p.x, p.y);
  if (maskValue > 0.5) {
    renderParticle(p); // Inside body
  }
});
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS |
| Particle count | 2000-5000 active |
| Latency | <100ms pose-to-visual |
| Resolution | 1920x1080 minimum |

### Optimization Strategies
- **Object pooling** for particles (no allocation during runtime)
- **Spatial hashing** for particle interactions if needed
- **WebGPU compute shaders** for 10k+ particles
- **Throttle MediaPipe** to 30fps if needed (visuals still 60fps)

---

## Build Phases

### Phase 1: Foundation
- [ ] MediaPipe pose + segmentation setup
- [ ] Basic body silhouette rendering
- [ ] Movement velocity detection
- [ ] Mirror mode for installation

### Phase 2: Single Element (Fire)
- [ ] Hand element form (flames in palms)
- [ ] Body infusion (energy inside silhouette)
- [ ] Charge system (4 levels)
- [ ] Aura effect at high charge
- [ ] Movement trails
- [ ] Release mechanic

### Phase 3: All Elements
- [ ] Water element (Hokusai style)
- [ ] Earth element (Sumi-e style)
- [ ] Air element (Rinpa style)
- [ ] Element cycle timer
- [ ] Smooth transitions
- [ ] Unique behaviors per element

### Phase 4: Environment
- [ ] Background intensity progression
- [ ] Element-specific environment particles
- [ ] Avatar State screen effects

### Phase 5: Polish
- [ ] Brush stroke particle sprites
- [ ] Washi paper texture overlay
- [ ] Audio integration (ambient + SFX)
- [ ] Training mode with 5 lessons
- [ ] Sandbox mode

### Phase 6: Optimization
- [ ] Performance profiling
- [ ] WebGPU upgrade if needed
- [ ] Mobile/tablet testing (bonus)

---

## File Structure (Suggested)

```
elemental-bender/
├── index.html              # Entry point
├── styles.css              # Base styles
├── src/
│   ├── main.js             # Initialization, render loop
│   ├── config.js           # All constants, colors, timings
│   ├── mediapipe.js        # Pose detection setup
│   ├── elements/
│   │   ├── element-base.js # Shared element behavior
│   │   ├── fire.js
│   │   ├── water.js
│   │   ├── earth.js
│   │   └── air.js
│   ├── systems/
│   │   ├── particle-system.js
│   │   ├── charge-system.js
│   │   ├── cycle-system.js
│   │   └── audio-system.js
│   ├── rendering/
│   │   ├── body-renderer.js
│   │   ├── environment-renderer.js
│   │   └── effects-renderer.js
│   └── modes/
│       ├── training-mode.js
│       └── sandbox-mode.js
├── assets/
│   ├── sprites/            # Brush stroke particle images
│   ├── textures/           # Washi paper texture
│   └── audio/              # Sound effects and ambient loops
└── README.md
```

---

## References

### Visual Inspiration
- **Water:** Hokusai "The Great Wave off Kanagawa"
- **Fire:** Fudō Myōō flame paintings, Edo fire scrolls
- **Earth:** Sesshu Tōyō landscape paintings
- **Air:** Ogata Kōrin "Wind God" screens

### Technical References
- MediaPipe Pose: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
- Three.js TSL: https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- WebGPU Particles: https://threejsroadmap.com/blog/galaxy-simulation-webgpu-compute-shaders

---

## Success Criteria

The installation is successful when:

1. ✓ User sees their elemental silhouette immediately upon entering frame
2. ✓ Standing still visibly charges energy (clear visual feedback)
3. ✓ Movement creates satisfying trails and releases
4. ✓ Each element feels distinct and true to its nature
5. ✓ Ukiyo-e aesthetic is recognizable (not generic particles)
6. ✓ Transitions between elements are smooth and magical
7. ✓ Avatar State feels epic and rewarding
8. ✓ 60 FPS maintained throughout
9. ✓ Works reliably for event duration (hours of continuous use)
10. ✓ Users smile and want to keep playing

---

*Document Version: 1.0*
*Created for: Anime Event Interactive Installation*
*Target Completion: Before February 2026*
