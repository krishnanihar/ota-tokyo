# Elemental Bender V2 - Complete Visual Overhaul

## Executive Summary

The current approach using WebGL with CPU-bound particle updates and basic post-processing isn't achieving the dramatic, fluid Hokusai-style effects we want. This plan outlines a complete visual overhaul using modern techniques.

---

## Architecture Decision: Hybrid Approach

After extensive research, the recommended approach combines:

1. **WebGPU + TSL Compute Shaders** - GPU-accelerated particle physics (100x performance)
2. **Metaball Post-Processing** - Particles blur and merge into organic blobs
3. **Curl Noise Flow Fields** - Element-specific fluid motion patterns
4. **Custom Trail Rendering** - Proper ping-pong buffer trails (not AfterimagePass)
5. **SDF Body Interaction** - Particles interact with body as signed distance field

---

## Phase 1: WebGPU Migration

### 1.1 Renderer Upgrade

Replace WebGL with WebGPU renderer:

```javascript
// NEW: WebGPU imports
import * as THREE from 'three/webgpu';
import {
  Fn, vec3, vec4, float, instanceIndex, instancedArray,
  storage, time, deltaTime, hash, If, Loop,
  pass, bloom, mx_fractal_noise_vec3
} from 'three/tsl';
```

**File: `src/rendering/SceneSetup.js`**
- Replace `THREE.WebGLRenderer` with `THREE.WebGPURenderer`
- Use `THREE.PostProcessing` instead of EffectComposer
- Set up MRT (Multi-Render Targets) for beauty + emissive passes

### 1.2 GPU Particle Storage Buffers

**File: `src/systems/GPUParticleSystem.js`** (NEW)

```javascript
// Storage buffers for 100,000+ particles
const positionBuffer = instancedArray(maxParticles, 'vec4'); // xyz + life
const velocityBuffer = instancedArray(maxParticles, 'vec4'); // xyz + type
const colorBuffer = instancedArray(maxParticles, 'vec4');    // rgba

// Compute shader for initialization
const computeInit = Fn(() => {
  const position = positionBuffer.element(instanceIndex);
  position.xyz.assign(vec3(10000)); // Off-screen
  position.w.assign(-1);            // Dead particle
})().compute(maxParticles);
```

### 1.3 GPU Physics Update

```javascript
const computeUpdate = Fn(() => {
  const position = positionBuffer.element(instanceIndex);
  const velocity = velocityBuffer.element(instanceIndex);
  const life = position.w;

  If(life.greaterThan(0), () => {
    // Apply curl noise for fluid motion
    const noisePos = position.xyz.mul(noiseScale);
    const curl = getCurlNoise(noisePos, time);
    velocity.xyz.addAssign(curl.mul(deltaTime));

    // Apply element-specific forces
    applyElementForces(position, velocity, elementType);

    // Update position
    position.xyz.addAssign(velocity.xyz.mul(deltaTime));

    // Decay life
    life.subAssign(deltaTime.mul(decayRate));
  });
})().compute(maxParticles);
```

---

## Phase 2: Curl Noise Flow Fields

### 2.1 Divergence-Free Noise

Implement curl noise for fluid-like particle motion:

```javascript
// TSL curl noise function
const getCurlNoise = Fn(([pos, t]) => {
  const eps = float(0.0001);

  // Sample noise at offset positions
  const dx = mx_fractal_noise_vec3(pos.add(vec3(eps, 0, 0)).add(t));
  const dy = mx_fractal_noise_vec3(pos.add(vec3(0, eps, 0)).add(t));
  const dz = mx_fractal_noise_vec3(pos.add(vec3(0, 0, eps)).add(t));

  // Compute curl (cross product of gradients)
  return vec3(
    dy.z.sub(dz.y),
    dz.x.sub(dx.z),
    dx.y.sub(dy.x)
  ).mul(1.0 / eps);
});
```

### 2.2 Element-Specific Flow Patterns

| Element | Flow Pattern | Noise Parameters |
|---------|-------------|------------------|
| Fire    | Upward turbulent | High frequency, fast time, Y-bias |
| Water   | Downward flowing | Medium freq, wave pattern, cascade |
| Earth   | Centripetal settling | Low frequency, gravity-dominant |
| Air     | Swirling vortex | High speed, orbital motion |

```javascript
const applyElementForces = Fn(([pos, vel, element]) => {
  // Fire: Upward bias + turbulence
  If(element.equal(FIRE), () => {
    vel.y.addAssign(fireUpwardForce);
    vel.addAssign(mx_fractal_noise_vec3(pos.mul(8).add(time.mul(2))).mul(turbulence));
  });

  // Water: Downward cascade with wave oscillation
  If(element.equal(WATER), () => {
    vel.y.subAssign(waterFallSpeed);
    vel.x.addAssign(sin(pos.y.mul(waveFreq).add(time)).mul(waveAmplitude));
  });

  // Earth: Gravitate toward center
  If(element.equal(EARTH), () => {
    const toCenter = bodyCenter.sub(pos.xyz);
    vel.addAssign(toCenter.normalize().mul(gravityStrength));
  });

  // Air: Vortex motion
  If(element.equal(AIR), () => {
    const tangent = vec3(pos.z.negate(), 0, pos.x).normalize();
    vel.addAssign(tangent.mul(vortexSpeed));
  });
});
```

---

## Phase 3: Metaball Post-Processing

### 3.1 Particle-to-Texture Render

Render particles to offscreen buffer, then apply metaball effect:

```javascript
// Step 1: Render particles to low-res texture
const particleRT = new THREE.WebGLRenderTarget(width/2, height/2);

// Step 2: Gaussian blur
const blurPass = gaussianBlur(particleRT.texture, sigma);

// Step 3: Threshold to create metaball blobs
const metaballShader = Fn(([uv]) => {
  const blurred = blurPass.sample(uv);
  const threshold = smoothstep(0.3, 0.6, blurred.r);
  return vec4(elementColor.mul(threshold), threshold);
});
```

### 3.2 SmoothMin Blending

For true liquid merging effect:

```javascript
// Signed distance field smooth minimum
const smin = Fn(([a, b, k]) => {
  const h = max(k.sub(abs(a.sub(b))), 0).div(k);
  return min(a, b).sub(h.mul(h).mul(k).mul(0.25));
});
```

---

## Phase 4: Body SDF Interaction

### 4.1 Convert Segmentation Mask to SDF

Transform the body silhouette mask into a signed distance field:

```javascript
// Compute distance from each pixel to nearest edge
const computeBodySDF = Fn(() => {
  const mask = bodyMaskTexture.sample(uv);
  const dist = jumpFloodSDF(mask); // Jump flooding algorithm

  // Negative inside body, positive outside
  return mask.greaterThan(0.5).select(dist.negate(), dist);
});
```

### 4.2 Particle-Body Collision

Particles can:
- Collide with body surface
- Flow along body contours
- Spawn from body edges

```javascript
const particleBodyInteraction = Fn(([pos]) => {
  const bodyDist = bodySDF.sample(posToUV(pos));

  // Collision response
  If(bodyDist.lessThan(0), () => {
    // Inside body - push to surface
    const gradient = getSDFGradient(pos);
    pos.addAssign(gradient.mul(bodyDist.abs()));

    // Reflect velocity
    velocity.assign(reflect(velocity, gradient));
  });
});
```

---

## Phase 5: Enhanced Trail System

### 5.1 Ping-Pong Frame Buffer

Replace AfterimagePass with proper ping-pong buffer:

```javascript
// Two render targets that swap each frame
const trailRT_A = new THREE.WebGLRenderTarget(width, height);
const trailRT_B = new THREE.WebGLRenderTarget(width, height);

const trailShader = Fn(([uv]) => {
  const previous = previousFrame.sample(uv);
  const current = currentFrame.sample(uv);

  // Decay previous frame
  const decayed = previous.mul(trailDecay);

  // Composite with current
  return max(decayed, current);
});
```

### 5.2 Motion Blur for Fast Movement

```javascript
// Velocity-based motion blur
const motionBlurShader = Fn(([uv]) => {
  const velocity = velocityBuffer.sample(uv);
  const samples = 8;
  let color = vec4(0);

  Loop(samples, (i) => {
    const offset = velocity.mul(float(i).div(samples).sub(0.5));
    color.addAssign(sceneTexture.sample(uv.add(offset)));
  });

  return color.div(samples);
});
```

---

## Phase 6: Rendering Pipeline

### 6.1 Sprite Node Material

```javascript
const particleMaterial = new THREE.SpriteNodeMaterial();
particleMaterial.blending = THREE.AdditiveBlending;
particleMaterial.depthWrite = false;

// Position from storage buffer
particleMaterial.positionNode = positionBuffer.toAttribute().xyz;

// Scale based on life
particleMaterial.scaleNode = positionBuffer.toAttribute().w.mul(baseSize);

// Color with life-based fade
particleMaterial.colorNode = Fn(() => {
  const life = positionBuffer.toAttribute().w;
  return colorBuffer.toAttribute().rgb.mul(life);
})();

// Soft circle shape
particleMaterial.opacityNode = Fn(() => {
  const dist = uv().sub(0.5).length();
  return smoothstep(0.5, 0.0, dist);
})();
```

### 6.2 Final Composite

```javascript
postProcessing.outputNode = Fn(() => {
  // Layer 1: Background
  const bg = backgroundColor;

  // Layer 2: Metaball particles
  const particles = metaballPass;

  // Layer 3: Body silhouette with internal energy
  const body = bodyPass;

  // Layer 4: Trails
  const trails = trailPass.mul(trailOpacity);

  // Layer 5: Bloom
  const bloomEffect = bloom(particles.add(body), strength, radius, threshold);

  // Composite
  return bg
    .add(trails)
    .add(particles)
    .add(body)
    .add(bloomEffect);
})();
```

---

## Implementation Order

### Week 1: Foundation
1. [ ] Migrate to WebGPU renderer
2. [ ] Create GPUParticleSystem with storage buffers
3. [ ] Implement basic compute shader update
4. [ ] Verify 60fps with 50,000 particles

### Week 2: Physics
5. [ ] Implement curl noise in TSL
6. [ ] Add element-specific flow patterns
7. [ ] Create body SDF from segmentation mask
8. [ ] Implement particle-body collision

### Week 3: Visual Effects
9. [ ] Create metaball post-processing
10. [ ] Implement ping-pong trail buffer
11. [ ] Add motion blur for fast movement
12. [ ] Fine-tune bloom and glow

### Week 4: Polish
13. [ ] Element transition effects
14. [ ] Charge level visual scaling
15. [ ] Performance optimization
16. [ ] Final color grading

---

## File Structure (New/Modified)

```
src/
├── rendering/
│   ├── SceneSetup.js          # MODIFY: WebGPU renderer
│   ├── BodyRenderer.js        # MODIFY: SDF generation
│   ├── PostProcessing.js      # NEW: Custom post-processing
│   └── TrailRenderer.js       # NEW: Ping-pong trails
├── systems/
│   ├── GPUParticleSystem.js   # NEW: WebGPU compute particles
│   ├── CurlNoiseField.js      # NEW: Flow field generation
│   └── BodySDF.js             # NEW: Segmentation to SDF
├── shaders/
│   ├── metaball.tsl.js        # NEW: Metaball effect
│   ├── curlNoise.tsl.js       # NEW: Curl noise functions
│   └── trail.tsl.js           # NEW: Trail compositing
└── elements/
    └── ElementBase.js         # MODIFY: Use GPU spawning
```

---

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Particle Count | 10,000 | 100,000 |
| Frame Rate | 30-60fps | Locked 60fps |
| Latency | 100ms+ | <50ms |
| GPU Usage | 40% | 80% |

---

## Fallback Strategy

If WebGPU not supported:
1. Detect with `navigator.gpu`
2. Fall back to WebGL2 with GPGPU via render-to-texture
3. Reduce particle count to 20,000
4. Simplify post-processing

---

## References

- [Three.js WebGPU Compute Particles](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles_snow.html)
- [TSL GPGPU Tutorial - Wawa Sensei](https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu)
- [Codrops Metaball Tutorial](https://tympanus.net/codrops/2025/06/09/how-to-create-interactive-droplet-like-metaballs-with-three-js-and-glsl/)
- [Curl Noise Implementation](https://github.com/kbladin/Curl_Noise)
- [Bitangent Noise (faster alternative)](https://atyuwen.github.io/posts/bitangent-noise/)
