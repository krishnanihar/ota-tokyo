// Water Element - Hokusai Great Wave Style
// Water flows DOWNWARD, dramatic flowing ribbons, foam spray, wave curls

import { ElementBase } from './ElementBase.js';
import { ChargeState } from '../config.js';

export class WaterElement extends ElementBase {
  constructor(particleSystem, segmentationMask) {
    super('water', particleSystem, segmentationMask);

    // Water-specific properties - DRAMATIC
    this.wavePhase = 0;
    this.rippleTimer = 0;
    this.rippleInterval = 0.08;   // Faster ripples
    this.rainTimer = 0;
    this.rainInterval = 0.02;     // Much more rain
    this.streamTimer = 0;
    this.streamInterval = 0.03;   // Continuous streams
    this.foamTimer = 0;
    this.foamInterval = 0.04;

    // Ribbon trail tracking for silk-like flow
    this.ribbonPoints = [];
    this.maxRibbonPoints = 30;
  }

  update(deltaTime, poseData) {
    super.update(deltaTime, poseData);

    if (!this.isActive) return;

    // Update wave animation - faster, more dramatic
    this.wavePhase += deltaTime * 4;

    // ALWAYS spawn rain - even at low charge
    this.rainTimer += deltaTime;
    if (this.rainTimer >= this.rainInterval) {
      this.rainTimer = 0;
      this.spawnRain();
    }

    // Spawn flowing streams at any charge
    this.streamTimer += deltaTime;
    if (this.streamTimer >= this.streamInterval) {
      this.streamTimer = 0;
      this.spawnFlowingStreams();
    }

    // Spawn ripples
    if (this.chargeLevel >= ChargeState.SPARK) {
      this.rippleTimer += deltaTime;
      if (this.rippleTimer >= this.rippleInterval) {
        this.rippleTimer = 0;
        this.spawnRipples();
      }
    }

    // Spawn foam at higher charge
    if (this.chargeLevel >= ChargeState.FORM) {
      this.foamTimer += deltaTime;
      if (this.foamTimer >= this.foamInterval) {
        this.foamTimer = 0;
        this.spawnFoamSpray();
      }
    }

    // Orbital water rings at power level
    if (this.chargeLevel >= ChargeState.POWER) {
      this.spawnOrbitalWaterRings();
    }

    // Hokusai wave crests at avatar level
    if (this.chargeLevel >= ChargeState.AVATAR) {
      this.spawnWaveCrest();
    }
  }

  spawnAmbientParticles() {
    // Dramatic water environment - rain and mist EVERYWHERE
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();

    // Heavy atmospheric rain/mist
    const count = 15 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      // Rain falls from top
      const y = height - 20 - Math.random() * 100;

      // Water always flows DOWN with wave motion
      const wave = Math.sin(this.wavePhase + x * 0.01) * 15;

      this.particles.spawn({
        x,
        y,
        vx: wave,
        vy: -(60 + Math.random() * 100),  // Fast downward
        size: 4 + Math.random() * 12,
        life: 1.5 + Math.random() * 1.5,
        type: 'ambient',
        colorIndex: Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : 2),
        alpha: 0.5 + Math.random() * 0.5
      });
    }

    // Mist rising from bottom
    for (let i = 0; i < 5; i++) {
      this.particles.spawn({
        x: Math.random() * width,
        y: 30 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 30,
        vy: 20 + Math.random() * 40,  // Rising mist
        size: 15 + Math.random() * 25,
        life: 2 + Math.random() * 2,
        type: 'ambient',
        colorIndex: 2,  // White foam/mist
        alpha: 0.2 + Math.random() * 0.3
      });
    }
  }

  spawnInternalParticles(poseData, rate) {
    // Water flows DOWNWARD inside body with dramatic wave motion
    const actualRate = rate * 2;  // Double the rate

    for (let i = 0; i < actualRate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Hokusai wave motion - sinusoidal with curl
      const waveAmplitude = this.behavior.waveAmplitude || 30;
      const wave = Math.sin(this.wavePhase + point.y * 15) * waveAmplitude;
      const curl = Math.cos(this.wavePhase * 0.7 + point.x * 10) * 10;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: wave + curl + (Math.random() - 0.5) * 20,
        vy: -(50 + Math.random() * 60),  // Strong downward
        size: 12 + Math.random() * 30,   // Large flowing particles
        life: 1.2 + Math.random() * 0.8,
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.75 ? 0 : (Math.random() < 0.5 ? 1 : 2)
      });
    }
  }

  spawnHandParticles(poseData) {
    // Swirling water spheres in hands with Hokusai wave curls
    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.3) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // Base swirling water sphere
      const baseCount = 8;
      const chargeCount = this.chargeLevel * 10;
      const totalCount = baseCount + chargeCount;

      for (let i = 0; i < totalCount; i++) {
        // Create swirling pattern like water spinning in hands
        const angle = (i / totalCount) * Math.PI * 2 + this.wavePhase * 3;
        const radius = 20 + Math.sin(this.wavePhase * 2 + i) * 15;

        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius * 0.6;  // Flattened sphere

        // Orbital velocity
        const orbitalSpeed = 80 + this.chargeLevel * 30;
        const vx = -Math.sin(angle) * orbitalSpeed;
        const vy = Math.cos(angle) * orbitalSpeed * 0.6 - 30;  // Downward bias

        this.particles.spawn({
          x: screenX + offsetX,
          y: screenY + offsetY,
          vx: vx + (Math.random() - 0.5) * 20,
          vy: vy + (Math.random() - 0.5) * 20,
          size: 10 + Math.random() * 20 + this.chargeLevel * 4,
          life: 0.5 + Math.random() * 0.4,
          type: 'hand',
          colorIndex: Math.random() < 0.6 ? 0 : 1
        });

        // Foam dots on the edges (Hokusai style)
        if (Math.random() < 0.4) {
          this.particles.spawn({
            x: screenX + offsetX * 1.3 + (Math.random() - 0.5) * 20,
            y: screenY + offsetY * 1.3 + (Math.random() - 0.5) * 20,
            vx: vx * 0.3 + (Math.random() - 0.5) * 50,
            vy: vy * 0.3 + Math.random() * 30,
            size: 3 + Math.random() * 6,
            life: 0.3 + Math.random() * 0.2,
            type: 'hand',
            colorIndex: 2  // White foam
          });
        }
      }
    });
  }

  spawnAuraParticles(poseData) {
    // Water aura: dramatic orbiting water rings + mist rising
    const edgePoints = this.mask?.getEdgePoints(60) || [];
    if (edgePoints.length === 0) return;

    const intensity = 0.4 + (this.chargeLevel / ChargeState.AVATAR) * 0.6;
    const count = Math.floor(edgePoints.length * intensity * 0.6);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Orbital motion around body - like water rings
      const orbitAngle = this.wavePhase * 2.5 + i * 0.3 + point.y * 5;
      const orbitRadius = 40 + Math.sin(this.wavePhase + i) * 20;

      const orbitX = Math.cos(orbitAngle) * orbitRadius;
      const orbitY = Math.sin(orbitAngle) * orbitRadius * 0.4;  // Flattened orbit

      // Velocity follows orbit
      const orbitalSpeed = 60 + this.chargeLevel * 20;

      this.particles.spawn({
        x: screenX + orbitX,
        y: screenY + orbitY,
        vx: -Math.sin(orbitAngle) * orbitalSpeed + (Math.random() - 0.5) * 30,
        vy: Math.cos(orbitAngle) * orbitalSpeed * 0.4 - 20,  // Slight downward
        size: 10 + Math.random() * 20 + this.chargeLevel * 3,
        life: 0.6 + Math.random() * 0.4,
        type: 'aura',
        colorIndex: Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? 1 : 2)
      });
    }

    // Mist rising from ground around feet
    const groundPoints = edgePoints.filter(p => p.y > 0.7);
    for (let i = 0; i < groundPoints.length * intensity * 0.3; i++) {
      const idx = Math.floor(Math.random() * groundPoints.length);
      const point = groundPoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();

      this.particles.spawn({
        x: screenX + (Math.random() - 0.5) * 60,
        y: 40 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 40,
        vy: 30 + Math.random() * 50,  // Rising mist
        size: 20 + Math.random() * 30,
        life: 1 + Math.random() * 1,
        type: 'aura',
        colorIndex: 2,  // White mist
        alpha: 0.3 + Math.random() * 0.3
      });
    }
  }

  spawnRain() {
    // Dramatic rain falling from top - HEAVY
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();
    const count = 10 + this.chargeLevel * 8;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const startY = height - 10 - Math.random() * 30;

      // Rain with wind effect
      const windWave = Math.sin(this.wavePhase * 0.5 + x * 0.005) * 20;

      this.particles.spawn({
        x,
        y: startY,
        vx: windWave + (Math.random() - 0.5) * 15,
        vy: -(150 + Math.random() * 150),  // Very fast rain
        size: 2 + Math.random() * 4,
        life: 0.4 + Math.random() * 0.3,
        type: 'environment',
        colorIndex: Math.random() < 0.7 ? 0 : 2  // Blue and white
      });
    }
  }

  spawnFlowingStreams() {
    // Continuous flowing water streams - silk ribbon effect
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();

    // Create flowing stream lines
    const streamCount = 3 + this.chargeLevel * 2;

    for (let s = 0; s < streamCount; s++) {
      const streamX = (0.1 + Math.random() * 0.8) * width;
      const streamPhase = this.wavePhase + s * 2;

      // Particles along the stream
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const x = streamX + Math.sin(streamPhase + t * 5) * 30;
        const y = height * (0.9 - t * 0.7);

        this.particles.spawn({
          x,
          y,
          vx: Math.cos(streamPhase + t * 5) * 40,
          vy: -(80 + Math.random() * 40),
          size: 8 + Math.random() * 15,
          life: 1 + Math.random() * 0.5,
          type: 'environment',
          colorIndex: 0
        });
      }
    }
  }

  spawnRipples() {
    // Dramatic ripple effects on "ground"
    const width = this.particles.scene.getWidth();
    const count = 2 + this.chargeLevel;

    for (let i = 0; i < count; i++) {
      const centerX = (0.1 + Math.random() * 0.8) * width;
      const centerY = 30 + Math.random() * 50;

      // Expanding ripple ring
      const ringParticles = 12 + this.chargeLevel * 4;
      const ringSpeed = 50 + this.chargeLevel * 20;

      for (let j = 0; j < ringParticles; j++) {
        const angle = (j / ringParticles) * Math.PI * 2;

        this.particles.spawn({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * ringSpeed,
          vy: Math.sin(angle) * ringSpeed * 0.25,  // Flatten for perspective
          size: 4 + Math.random() * 6,
          life: 0.8 + Math.random() * 0.4,
          type: 'environment',
          colorIndex: 2  // White ripples
        });
      }
    }
  }

  spawnFoamSpray() {
    // Hokusai-style foam spray particles
    const width = this.particles.scene.getWidth();
    const count = 5 + this.chargeLevel * 3;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * this.particles.scene.getHeight() * 0.5;

      this.particles.spawn({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        size: 2 + Math.random() * 5,
        life: 0.4 + Math.random() * 0.3,
        type: 'environment',
        colorIndex: 2,  // White foam
        alpha: 0.7 + Math.random() * 0.3
      });
    }
  }

  spawnOrbitalWaterRings() {
    // Large orbital water rings around entire body
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();
    const centerX = width / 2;
    const centerY = height / 2;

    const ringCount = 20;
    const ringRadius = 200 + Math.sin(this.wavePhase) * 30;

    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 + this.wavePhase * 1.5;
      const x = centerX + Math.cos(angle) * ringRadius;
      const y = centerY + Math.sin(angle) * ringRadius * 0.3;  // Flattened

      this.particles.spawn({
        x,
        y,
        vx: -Math.sin(angle) * 100,
        vy: Math.cos(angle) * 30,
        size: 15 + Math.random() * 20,
        life: 0.5 + Math.random() * 0.3,
        type: 'aura',
        colorIndex: Math.random() < 0.5 ? 0 : 1
      });
    }
  }

  spawnWaveCrest() {
    // THE GREAT WAVE - Hokusai iconic wave crest with claw-like tips
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();

    // Multiple waves at different positions for dynamic feel
    const waveCount = 2 + Math.floor(this.chargeLevel / 2);

    for (let w = 0; w < waveCount; w++) {
      // Wave crest position - animate across screen
      const waveX = width * (0.2 + w * 0.3 + Math.sin(this.wavePhase * 0.3 + w) * 0.15);
      const waveY = height * (0.75 + w * 0.08);
      const waveScale = 1 - w * 0.2; // Smaller waves in back

      // The iconic Hokusai curl - tighter spiral
      const curlPoints = 40;
      for (let i = 0; i < curlPoints; i++) {
        const t = i / curlPoints;
        // Tighter curl that hooks back (like the famous wave)
        const curlAngle = t * Math.PI * 2.2;
        const curlRadius = (40 + t * 80) * waveScale;

        // Hook shape - curls over and back
        const hookFactor = Math.pow(t, 0.7);
        const x = waveX + Math.cos(curlAngle) * curlRadius * hookFactor;
        const y = waveY - Math.sin(curlAngle) * curlRadius * 0.7;

        // Larger particles at the base, smaller at tip
        const sizeFactor = 1 - t * 0.4;

        this.particles.spawn({
          x,
          y,
          vx: Math.cos(curlAngle + Math.PI * 0.5) * 60 * waveScale,
          vy: -Math.sin(curlAngle + Math.PI * 0.5) * 50 - 20,
          size: (25 + Math.random() * 30) * sizeFactor * waveScale,
          life: 0.7 + Math.random() * 0.4,
          type: 'environment',
          colorIndex: t < 0.6 ? 0 : 1  // Deep blue base, lighter tips
        });

        // CLAW-LIKE FOAM TIPS - the iconic Hokusai detail
        if (t > 0.4) {
          // Multiple foam "fingers" extending from wave
          const foamCount = t > 0.7 ? 3 : 2;
          for (let f = 0; f < foamCount; f++) {
            const fingerAngle = curlAngle + (f - 1) * 0.3;
            const fingerLength = 15 + Math.random() * 25;

            this.particles.spawn({
              x: x + Math.cos(fingerAngle) * fingerLength,
              y: y - Math.sin(fingerAngle) * fingerLength * 0.8,
              vx: Math.cos(fingerAngle) * 80 + (Math.random() - 0.5) * 40,
              vy: -Math.sin(fingerAngle) * 60 + Math.random() * 30,
              size: 3 + Math.random() * 6,
              life: 0.25 + Math.random() * 0.2,
              type: 'environment',
              colorIndex: 2  // White foam
            });
          }
        }
      }

      // Spray dots around the crest (Hokusai's scattered foam)
      const sprayCount = 15 + this.chargeLevel * 5;
      for (let i = 0; i < sprayCount; i++) {
        const sprayAngle = Math.random() * Math.PI;
        const sprayDist = 30 + Math.random() * 80;

        this.particles.spawn({
          x: waveX + Math.cos(sprayAngle) * sprayDist,
          y: waveY - 20 - Math.random() * 60,
          vx: (Math.random() - 0.5) * 120,
          vy: -20 + Math.random() * 80,
          size: 2 + Math.random() * 4,
          life: 0.2 + Math.random() * 0.2,
          type: 'environment',
          colorIndex: 2,
          alpha: 0.8 + Math.random() * 0.2
        });
      }
    }
  }

  onSlowMove(poseData) {
    super.onSlowMove(poseData);

    // SILK RIBBON water trail - connected flowing particles
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // Long flowing ribbon trail - many connected particles
      const ribbonLength = 20 + this.chargeLevel * 10;

      for (let i = 0; i < ribbonLength; i++) {
        const t = i / ribbonLength;
        const wave = Math.sin(this.wavePhase * 3 + i * 0.5) * 20;
        const curl = Math.cos(this.wavePhase * 2 + i * 0.3) * 15;

        // Offset along trail direction
        const trailX = screenX - dir.x * i * 8;
        const trailY = screenY + dir.y * i * 8;

        this.particles.spawn({
          x: trailX + wave,
          y: trailY + curl,
          vx: -dir.x * 40 + wave * 2 + (Math.random() - 0.5) * 20,
          vy: dir.y * 40 + curl - 30,  // Downward water pull
          size: (1 - t * 0.5) * (15 + Math.random() * 20),  // Taper
          life: 1 + Math.random() * 0.5,
          type: 'trail',
          colorIndex: Math.random() < 0.7 ? 0 : 1
        });
      }

      // Foam spray around trail
      for (let i = 0; i < 10 + this.chargeLevel * 5; i++) {
        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 60,
          y: screenY + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 100,
          vy: (Math.random() - 0.5) * 100 - 20,
          size: 3 + Math.random() * 5,
          life: 0.3 + Math.random() * 0.3,
          type: 'trail',
          colorIndex: 2  // White foam
        });
      }
    });
  }

  onFastMove(poseData, releaseData) {
    super.onFastMove(poseData, releaseData);

    // HOKUSAI GREAT WAVE release - massive wave with iconic curl
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();
      const power = releaseData.level * this.behavior.releaseForce;

      // Main wave body - MASSIVE
      const waveParticles = 60 + releaseData.level * 40;
      for (let i = 0; i < waveParticles; i++) {
        // Create wave shape with curl
        const spread = (i / waveParticles - 0.5) * 2;
        const curlFactor = Math.sin(spread * Math.PI) * 0.6;
        const heightVar = Math.cos(spread * Math.PI * 0.5);

        const speedVar = 0.7 + Math.random() * 0.6;
        const baseSpeed = 250 * power * speedVar;

        this.particles.spawn({
          x: screenX,
          y: screenY,
          vx: (dir.x + spread * 0.4) * baseSpeed,
          vy: (-dir.y + curlFactor) * baseSpeed + heightVar * 50,
          size: 15 + Math.random() * 30 + releaseData.level * 5,
          life: 1.2 + Math.random() * 0.6,
          type: 'projectile',
          colorIndex: Math.random() < 0.7 ? 0 : 1
        });
      }

      // Wave crest curl - iconic Hokusai pattern
      const curlParticles = 30 + releaseData.level * 20;
      for (let i = 0; i < curlParticles; i++) {
        const t = i / curlParticles;
        const curlAngle = t * Math.PI * 1.2;
        const curlRadius = 30 + t * 50;

        const curlOffsetX = Math.cos(curlAngle) * curlRadius * dir.x;
        const curlOffsetY = -Math.sin(curlAngle) * curlRadius;

        this.particles.spawn({
          x: screenX + curlOffsetX * 0.5,
          y: screenY + curlOffsetY * 0.5,
          vx: dir.x * 200 * power + Math.cos(curlAngle + Math.PI * 0.5) * 80,
          vy: -dir.y * 200 * power - Math.sin(curlAngle + Math.PI * 0.5) * 60,
          size: 12 + Math.random() * 20,
          life: 0.8 + Math.random() * 0.4,
          type: 'projectile',
          colorIndex: 0  // Deep Prussian blue
        });
      }

      // Massive foam explosion
      const foamCount = 50 + releaseData.level * 30;
      for (let i = 0; i < foamCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 150;

        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 50,
          y: screenY + (Math.random() - 0.5) * 50,
          vx: dir.x * 150 * power + Math.cos(angle) * speed,
          vy: -dir.y * 150 * power + Math.sin(angle) * speed,
          size: 3 + Math.random() * 8,
          life: 0.5 + Math.random() * 0.4,
          type: 'projectile',
          colorIndex: 2  // White foam
        });
      }

      // Trailing mist
      for (let i = 0; i < releaseData.level * 15; i++) {
        this.particles.spawn({
          x: screenX - dir.x * (20 + Math.random() * 50),
          y: screenY + dir.y * (20 + Math.random() * 50),
          vx: dir.x * 50 + (Math.random() - 0.5) * 80,
          vy: -dir.y * 50 + Math.random() * 40,
          size: 20 + Math.random() * 30,
          life: 1 + Math.random() * 1,
          type: 'projectile',
          colorIndex: 2,
          alpha: 0.3 + Math.random() * 0.3
        });
      }
    });
  }

  getHandVelocityX() {
    // Sinusoidal wave motion
    return Math.sin(this.wavePhase * 2) * 40;
  }

  getHandVelocityY() {
    // Strong downward pull for water
    return -(40 + Math.random() * 40);
  }
}
