// GPU Particle System using WebGPU Compute Shaders (TSL)
// Phase 1: Foundation for 100,000+ particle simulation

import { CONFIG, COLORS, ELEMENT_BEHAVIORS, hexToRgb } from '../config.js';

export class GPUParticleSystem {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.isWebGPU = sceneSetup.hasWebGPU();
    this.THREE = sceneSetup.getTHREE();
    this.tsl = sceneSetup.getTSL();

    // Particle configuration
    this.maxParticles = CONFIG.MAX_PARTICLES || 100000;
    this.activeParticles = 0;

    // Storage buffers (GPU-side data)
    this.positionBuffer = null;   // vec4: xyz position + life
    this.velocityBuffer = null;   // vec4: xyz velocity + type
    this.colorBuffer = null;      // vec4: rgba

    // Compute shaders
    this.computeInit = null;
    this.computeUpdate = null;
    this.computeSpawn = null;

    // Rendering
    this.particleMesh = null;
    this.particleMaterial = null;

    // Element state
    this.currentElement = 'fire';
    this.elementColors = null;

    // Spawn queue (CPU-side, batched to GPU)
    this.spawnQueue = [];
    this.nextSpawnIndex = 0;

    // Uniforms
    this.uniforms = {};
  }

  async initialize() {
    if (this.isWebGPU) {
      await this.initializeWebGPU();
    } else {
      await this.initializeWebGL();
    }

    console.log(`GPUParticleSystem initialized: ${this.maxParticles} particles (${this.isWebGPU ? 'WebGPU' : 'WebGL'})`);
  }

  async initializeWebGPU() {
    const THREE = this.THREE;

    // Validate TSL module is available
    if (!this.tsl) {
      throw new Error('TSL module not available for WebGPU particle system');
    }

    // Check for required TSL functions
    const requiredFns = ['Fn', 'vec3', 'vec4', 'vec2', 'float', 'instanceIndex', 'uniform', 'instancedArray'];
    for (const fn of requiredFns) {
      if (!this.tsl[fn]) {
        throw new Error(`TSL function '${fn}' not available - WebGPU compute may not be supported`);
      }
    }

    const {
      Fn, vec3, vec4, vec2, float, uint, instanceIndex,
      storage, time, deltaTime, hash, If, Loop,
      instancedArray, uniform, attribute,
      sin, cos, length, normalize, max, min, mix, smoothstep, step
    } = this.tsl;

    // Create storage buffers for particle data
    this.positionBuffer = instancedArray(this.maxParticles, 'vec4');
    this.velocityBuffer = instancedArray(this.maxParticles, 'vec4');
    this.colorBuffer = instancedArray(this.maxParticles, 'vec4');

    // Create uniforms
    this.uniforms = {
      elementType: uniform(0),
      noiseScale: uniform(0.01),
      noiseSpeed: uniform(1.0),
      gravity: uniform(vec3(0, 0, 0)),
      decay: uniform(0.98),
      bodyCenter: uniform(vec3(this.scene.getWidth() / 2, this.scene.getHeight() / 2, 0)),
      screenSize: uniform(vec3(this.scene.getWidth(), this.scene.getHeight(), 1))
    };

    // Initialize particles (all dead/off-screen)
    this.computeInit = Fn(() => {
      const position = this.positionBuffer.element(instanceIndex);
      const velocity = this.velocityBuffer.element(instanceIndex);
      const color = this.colorBuffer.element(instanceIndex);

      // Position far off-screen, life = -1 (dead)
      position.xyz.assign(vec3(10000, 10000, 0));
      position.w.assign(float(-1));

      // Zero velocity
      velocity.assign(vec4(0, 0, 0, 0));

      // Default color
      color.assign(vec4(1, 1, 1, 0));
    })().compute(this.maxParticles);

    // Update particles each frame with element-specific flow
    this.computeUpdate = Fn(() => {
      const position = this.positionBuffer.element(instanceIndex);
      const velocity = this.velocityBuffer.element(instanceIndex);
      const color = this.colorBuffer.element(instanceIndex);

      const life = position.w;
      const particleType = velocity.w;

      // Only update living particles
      If(life.greaterThan(0), () => {
        // Get normalized position for noise
        const normX = position.x.div(this.uniforms.screenSize.x);
        const normY = position.y.div(this.uniforms.screenSize.y);

        // ELEMENT-SPECIFIC CURL NOISE PATTERNS
        // Each element has unique flow characteristics

        // Fire: Upward turbulent flow
        const fireNoiseFreq = float(8.0);
        const fireNoise = this.curlNoise2D(vec2(
          normX.mul(fireNoiseFreq).add(time.mul(2.0)),
          normY.mul(fireNoiseFreq).add(time.mul(1.5))
        ));
        const fireForce = vec2(
          fireNoise.x.mul(40.0),
          fireNoise.y.mul(30.0).add(60.0)  // Strong upward bias
        );

        // Water: Downward cascading with wave oscillation
        const waterWaveFreq = float(4.0);
        const waterWave = sin(normY.mul(10.0).add(time.mul(3.0)));
        const waterNoise = this.curlNoise2D(vec2(
          normX.mul(waterWaveFreq).add(time.mul(0.8)),
          normY.mul(waterWaveFreq).add(time.mul(0.5))
        ));
        const waterForce = vec2(
          waterNoise.x.mul(25.0).add(waterWave.mul(15.0)),  // Wave oscillation
          waterNoise.y.mul(20.0).sub(40.0)  // Downward cascade
        );

        // Earth: Centripetal settling with low-frequency noise
        const earthNoiseFreq = float(2.0);
        const earthNoise = this.curlNoise2D(vec2(
          normX.mul(earthNoiseFreq).add(time.mul(0.2)),
          normY.mul(earthNoiseFreq).add(time.mul(0.2))
        ));
        // Pull toward center (0.5, 0.5)
        const toCenterX = float(0.5).sub(normX).mul(30.0);
        const toCenterY = float(0.5).sub(normY).mul(30.0);
        const earthForce = vec2(
          earthNoise.x.mul(10.0).add(toCenterX),
          earthNoise.y.mul(10.0).add(toCenterY).sub(30.0)  // Also gravity
        );

        // Air: High-speed vortex swirl
        const airNoiseFreq = float(6.0);
        const airNoise = this.curlNoise2D(vec2(
          normX.mul(airNoiseFreq).add(time.mul(3.0)),
          normY.mul(airNoiseFreq).add(time.mul(2.5))
        ));
        // Tangential force for swirling
        const dx = normX.sub(0.5);
        const dy = normY.sub(0.5);
        const tangentX = dy.negate().mul(80.0);
        const tangentY = dx.mul(80.0);
        const airForce = vec2(
          airNoise.x.mul(50.0).add(tangentX),
          airNoise.y.mul(50.0).add(tangentY)
        );

        // Select force based on element type using step functions
        const isFire = step(particleType, float(0.5));
        const isWater = step(float(0.5), particleType).mul(step(particleType, float(1.5)));
        const isEarth = step(float(1.5), particleType).mul(step(particleType, float(2.5)));
        const isAir = step(float(2.5), particleType);

        // Blend forces
        const forceX = fireForce.x.mul(isFire)
          .add(waterForce.x.mul(isWater))
          .add(earthForce.x.mul(isEarth))
          .add(airForce.x.mul(isAir));

        const forceY = fireForce.y.mul(isFire)
          .add(waterForce.y.mul(isWater))
          .add(earthForce.y.mul(isEarth))
          .add(airForce.y.mul(isAir));

        // Apply forces to velocity
        velocity.x.addAssign(forceX.mul(deltaTime));
        velocity.y.addAssign(forceY.mul(deltaTime));

        // Apply velocity
        position.x.addAssign(velocity.x.mul(deltaTime).mul(60));
        position.y.addAssign(velocity.y.mul(deltaTime).mul(60));

        // Apply friction/decay
        velocity.x.mulAssign(this.uniforms.decay);
        velocity.y.mulAssign(this.uniforms.decay);

        // Decay life
        life.subAssign(deltaTime);

        // Fade alpha with life - quick fade at end
        color.w.assign(smoothstep(float(0), float(0.3), life).mul(0.8));

        // Boundary check - reset if off screen
        const screenW = this.uniforms.screenSize.x;
        const screenH = this.uniforms.screenSize.y;
        If(position.x.lessThan(-50).or(position.x.greaterThan(screenW.add(50)))
          .or(position.y.lessThan(-50)).or(position.y.greaterThan(screenH.add(50))), () => {
          position.w.assign(-1); // Kill particle
        });
      });
    })().compute(this.maxParticles);

    // Create particle rendering mesh
    await this.createWebGPUParticleMesh();

    // Run initialization
    await this.scene.compute(this.computeInit);

    console.log('WebGPU particle system initialized with TSL compute shaders');
  }

  // Simple 2D curl noise approximation using TSL
  // Returns inline TSL expressions (no Fn wrapper needed for helper)
  curlNoise2D(p) {
    const { sin, cos, vec2 } = this.tsl;
    // Approximate curl noise using sine/cosine combinations
    const x = sin(p.y.mul(3.14159).add(p.x.mul(0.5))).mul(0.5);
    const y = cos(p.x.mul(3.14159).sub(p.y.mul(0.5))).mul(0.5);
    return vec2(x, y);
  }

  // Get gravity direction based on element type
  // This returns a TSL expression that evaluates per-particle
  getElementGravity(particleType) {
    const { float, mix, step, sub } = this.tsl;

    // Use smooth interpolation instead of branching for better GPU perf
    // Element types: 0=fire(up), 1=water(down), 2=earth(down strong), 3=air(none)

    // Fire (type 0): +50 upward
    // Water (type 1): -30 downward
    // Earth (type 2): -80 strong down
    // Air (type 3): 0 no gravity

    // Simplified approach using step functions
    const isFire = step(particleType, float(0.5));        // 1 if fire, 0 otherwise
    const isWater = step(float(0.5), particleType).mul(step(particleType, float(1.5)));
    const isEarth = step(float(1.5), particleType).mul(step(particleType, float(2.5)));
    const isAir = step(float(2.5), particleType);

    // Combine gravity values
    const gravity = isFire.mul(50.0)
      .add(isWater.mul(-30.0))
      .add(isEarth.mul(-80.0))
      .add(isAir.mul(0.0));

    return gravity;
  }

  async createWebGPUParticleMesh() {
    const THREE = this.THREE;
    const { uv, smoothstep, instanceIndex, vec4 } = this.tsl;

    // Particle geometry (simple quad)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Create SpriteNodeMaterial for particles
    const material = new THREE.SpriteNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;

    // Position from storage buffer
    material.positionNode = this.positionBuffer.toAttribute().xyz;

    // Scale based on particle type and life
    const life = this.positionBuffer.toAttribute().w;
    const baseSize = this.tsl.float(8);
    material.scaleNode = this.tsl.vec2(baseSize.mul(life.add(0.3)));

    // Color from storage buffer with life-based alpha
    material.colorNode = this.tsl.Fn(() => {
      const col = this.colorBuffer.toAttribute();
      return col.rgb;
    })();

    // Opacity: soft circle shape with life fade
    material.opacityNode = this.tsl.Fn(() => {
      const dist = uv().sub(0.5).length();
      const circle = smoothstep(this.tsl.float(0.5), this.tsl.float(0.1), dist);
      const life = this.positionBuffer.toAttribute().w;
      const lifeAlpha = smoothstep(this.tsl.float(0), this.tsl.float(0.2), life);
      return circle.mul(lifeAlpha).mul(0.7);
    })();

    // Create instanced mesh
    this.particleMesh = new THREE.InstancedMesh(geometry, material, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    this.scene.add(this.particleMesh);
    this.particleMaterial = material;
  }

  async initializeWebGL() {
    // Fallback to existing CPU-based particle system
    // Import the old particle system for WebGL fallback
    console.log('Using WebGL fallback - importing legacy ParticleSystem');

    // For now, we'll use a simplified version
    // The full integration would import the existing ParticleSystem
    this.legacyMode = true;
  }

  setElement(elementType) {
    this.currentElement = elementType;
    const colors = COLORS[elementType];
    this.elementColors = {
      primary: hexToRgb(colors.primary),
      secondary: hexToRgb(colors.secondary),
      accent: hexToRgb(colors.accent),
      glow: hexToRgb(colors.glow)
    };

    // Update element type uniform
    const elementIndex = { fire: 0, water: 1, earth: 2, air: 3 };
    if (this.uniforms.elementType) {
      this.uniforms.elementType.value = elementIndex[elementType] || 0;
    }

    // Update decay based on element
    const behavior = ELEMENT_BEHAVIORS[elementType];
    if (this.uniforms.decay && behavior) {
      this.uniforms.decay.value = behavior.decay;
    }
  }

  // Spawn particles - queued for batch GPU upload
  spawn(options) {
    if (this.legacyMode) {
      // Use legacy CPU spawning
      return;
    }

    this.spawnQueue.push({
      x: options.x || 0,
      y: options.y || 0,
      vx: options.vx || 0,
      vy: options.vy || 0,
      size: options.size || 5,
      life: options.life || 1,
      colorIndex: options.colorIndex || 0,
      alpha: options.alpha || 1,
      type: options.type || 'ambient'
    });
  }

  // Process spawn queue and upload to GPU
  async processSpawnQueue() {
    if (this.spawnQueue.length === 0 || this.legacyMode) return;

    // In a full implementation, we would:
    // 1. Find dead particles (life < 0)
    // 2. Batch update their data via compute shader
    // 3. Clear the spawn queue

    // For now, we'll process in batches via CPU->GPU transfer
    // This will be optimized with a proper spawn compute shader

    const THREE = this.THREE;
    const batch = this.spawnQueue.splice(0, Math.min(this.spawnQueue.length, 1000));

    for (const particle of batch) {
      const idx = this.nextSpawnIndex;
      this.nextSpawnIndex = (this.nextSpawnIndex + 1) % this.maxParticles;

      // Get color based on colorIndex
      let color = this.elementColors?.primary || { r: 1, g: 1, b: 1 };
      if (particle.colorIndex === 1 && this.elementColors?.secondary) {
        color = this.elementColors.secondary;
      } else if (particle.colorIndex === 2 && this.elementColors?.accent) {
        color = this.elementColors.accent;
      }

      // Update buffers (this is a temporary CPU-side approach)
      // Full implementation would use compute shader for spawning
      if (this.positionBuffer && this.positionBuffer.array) {
        const posArr = this.positionBuffer.array;
        const velArr = this.velocityBuffer.array;
        const colArr = this.colorBuffer.array;

        posArr[idx * 4] = particle.x;
        posArr[idx * 4 + 1] = particle.y;
        posArr[idx * 4 + 2] = 0;
        posArr[idx * 4 + 3] = particle.life;

        velArr[idx * 4] = particle.vx / 60; // Convert to per-frame
        velArr[idx * 4 + 1] = particle.vy / 60;
        velArr[idx * 4 + 2] = 0;
        velArr[idx * 4 + 3] = this.getParticleTypeIndex();

        colArr[idx * 4] = color.r;
        colArr[idx * 4 + 1] = color.g;
        colArr[idx * 4 + 2] = color.b;
        colArr[idx * 4 + 3] = particle.alpha;
      }
    }
  }

  getParticleTypeIndex() {
    const types = { fire: 0, water: 1, earth: 2, air: 3 };
    return types[this.currentElement] || 0;
  }

  async update(deltaTime) {
    if (this.legacyMode) return;

    // Process any queued spawns
    await this.processSpawnQueue();

    // Run update compute shader
    if (this.computeUpdate) {
      await this.scene.compute(this.computeUpdate);
    }
  }

  // Get active particle count (approximate)
  getActiveCount() {
    return this.activeParticles;
  }

  // Clear all particles
  clear() {
    if (this.legacyMode) return;

    // Reset spawn index and clear queue
    this.spawnQueue = [];
    this.nextSpawnIndex = 0;

    // Re-run init compute to reset all particles
    if (this.computeInit) {
      this.scene.compute(this.computeInit);
    }
  }

  // Convenience methods for API compatibility with legacy ParticleSystem

  spawnBurst(x, y, count, options = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (options.speed ?? 50) * (0.5 + Math.random() * 0.5);

      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed + (options.directionX ?? 0) * 100,
        vy: Math.sin(angle) * speed + (options.directionY ?? 0) * 100,
        size: options.size ?? 5,
        life: options.life ?? (0.5 + Math.random() * 0.5),
        type: options.type ?? 'normal',
        colorIndex: Math.floor(Math.random() * 3)
      });
    }
  }

  spawnTrail(x, y, directionX, directionY, intensity = 1) {
    const count = Math.floor(3 * intensity);
    const behavior = ELEMENT_BEHAVIORS[this.currentElement];

    for (let i = 0; i < count; i++) {
      const perpX = -directionY;
      const perpY = directionX;
      const spread = (Math.random() - 0.5) * 20;

      this.spawn({
        x: x + perpX * spread,
        y: y + perpY * spread,
        vx: -directionX * 30 * behavior.speed + (Math.random() - 0.5) * 20,
        vy: -directionY * 30 * behavior.speed + (Math.random() - 0.5) * 20,
        size: 4 + Math.random() * 4,
        life: behavior.trailLength * (0.3 + Math.random() * 0.3),
        type: 'trail',
        colorIndex: Math.floor(Math.random() * 2)
      });
    }
  }

  spawnProjectile(x, y, directionX, directionY, chargeLevel) {
    const behavior = ELEMENT_BEHAVIORS[this.currentElement];
    const power = chargeLevel * behavior.releaseForce;
    const count = 10 + chargeLevel * 10;

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.3;
      const speedVariation = 0.7 + Math.random() * 0.6;

      this.spawn({
        x,
        y,
        vx: (directionX + spread) * 200 * power * speedVariation,
        vy: (directionY + spread) * 200 * power * speedVariation,
        size: 4 + Math.random() * 6 + chargeLevel * 2,
        life: 0.8 + Math.random() * 0.4,
        type: 'projectile',
        colorIndex: Math.floor(Math.random() * 3)
      });
    }
  }

  spawnInsideBody(bodyPoints, maskChecker, count = 5) {
    const behavior = ELEMENT_BEHAVIORS[this.currentElement];

    for (let i = 0; i < count; i++) {
      const point = maskChecker?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.scene.getWidth();
      const screenY = (1 - point.y) * this.scene.getHeight();

      let vx = 0, vy = 0;
      switch (behavior.particleDirection) {
        case 'up':
          vy = 30 + Math.random() * 30;
          vx = (Math.random() - 0.5) * 20;
          break;
        case 'down':
          vy = -(30 + Math.random() * 30);
          vx = (Math.random() - 0.5) * 20;
          break;
        case 'center':
          vx = (Math.random() - 0.5) * 10;
          vy = (Math.random() - 0.5) * 10;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 20;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
      }

      this.spawn({
        x: screenX,
        y: screenY,
        vx: vx * behavior.speed,
        vy: vy * behavior.speed,
        size: 3 + Math.random() * 5,
        life: 1 + Math.random(),
        type: 'internal',
        colorIndex: Math.floor(Math.random() * 2)
      });
    }
  }

  spawnAura(edgePoints, intensity = 1) {
    const behavior = ELEMENT_BEHAVIORS[this.currentElement];
    const count = Math.floor(edgePoints.length * intensity * 0.3);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];

      const screenX = point.x * this.scene.getWidth();
      const screenY = (1 - point.y) * this.scene.getHeight();

      const outwardX = (Math.random() - 0.5) * 50;
      const outwardY = -20 - Math.random() * 30;

      this.spawn({
        x: screenX + (Math.random() - 0.5) * 10,
        y: screenY + (Math.random() - 0.5) * 10,
        vx: outwardX * behavior.speed,
        vy: outwardY * behavior.speed,
        size: 3 + Math.random() * 5,
        life: 0.5 + Math.random() * 0.5,
        type: 'aura',
        colorIndex: 0
      });
    }
  }

  dispose() {
    if (this.particleMesh) {
      this.particleMesh.geometry.dispose();
      this.particleMesh.material.dispose();
      this.scene.remove(this.particleMesh);
    }
  }
}
