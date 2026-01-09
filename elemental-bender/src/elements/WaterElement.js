// Water Element - Hokusai Wave Style
// Water flows DOWNWARD, medium fluid speed, flowing dissipation

import { ElementBase } from './ElementBase.js';
import { ChargeState } from '../config.js';

export class WaterElement extends ElementBase {
  constructor(particleSystem, segmentationMask) {
    super('water', particleSystem, segmentationMask);

    // Water-specific properties
    this.wavePhase = 0;
    this.rippleTimer = 0;
    this.rippleInterval = 0.15;
    this.rainTimer = 0;
    this.rainInterval = 0.05;
  }

  update(deltaTime, poseData) {
    super.update(deltaTime, poseData);

    if (!this.isActive) return;

    // Update wave animation
    this.wavePhase += deltaTime * 2;

    // Spawn rain at high charge
    if (this.chargeLevel >= ChargeState.FORM) {
      this.rainTimer += deltaTime;
      if (this.rainTimer >= this.rainInterval) {
        this.rainTimer = 0;
        this.spawnRain();
      }
    }

    // Spawn ripples at power level
    if (this.chargeLevel >= ChargeState.POWER) {
      this.rippleTimer += deltaTime;
      if (this.rippleTimer >= this.rippleInterval) {
        this.rippleTimer = 0;
        this.spawnRipples();
      }
    }
  }

  spawnInternalParticles(poseData) {
    // Water particles flow downward inside body
    const rate = this.chargeLevel * 3;

    for (let i = 0; i < rate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Wave motion sideways while falling
      const wave = Math.sin(this.wavePhase + point.y * 10) * 15;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: wave + (Math.random() - 0.5) * 10,
        vy: -(30 + Math.random() * 30), // Downward
        size: this.particles.randomSize() * 0.7,
        life: 0.8 + Math.random() * 0.6,
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.8 ? 0 : 2 // Mostly Prussian blue, some foam white
      });
    }
  }

  spawnAuraParticles(poseData) {
    // Water aura: rings of water orbit body, mist rises from ground
    const edgePoints = this.mask?.getEdgePoints(40) || [];
    const intensity = (this.chargeLevel - 1) / 3;

    // Focus on lower half for water pooling effect
    const lowerPoints = edgePoints.filter(p => p.y > 0.4);

    for (let i = 0; i < lowerPoints.length * intensity * 0.3; i++) {
      const idx = Math.floor(Math.random() * lowerPoints.length);
      const point = lowerPoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Orbital motion around body
      const orbitAngle = this.wavePhase * 2 + i * 0.5;
      const orbitX = Math.cos(orbitAngle) * 30;
      const orbitY = Math.sin(orbitAngle) * 10; // Flatter orbit

      this.particles.spawn({
        x: screenX + orbitX,
        y: screenY + orbitY,
        vx: -Math.sin(orbitAngle) * 40,
        vy: Math.cos(orbitAngle) * 20 - 10, // Slight downward bias
        size: this.particles.randomSize() * 0.6,
        life: 0.4 + Math.random() * 0.3,
        type: 'aura',
        colorIndex: Math.random() < 0.7 ? 1 : 2 // Indigo and foam white
      });
    }
  }

  spawnRain() {
    // Rain drops falling from top
    const count = this.chargeLevel >= ChargeState.AVATAR ? 8 : 3;

    for (let i = 0; i < count; i++) {
      const screenX = Math.random() * this.particles.scene.getWidth();
      const screenY = this.particles.scene.getHeight() - 20 - Math.random() * 50;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: (Math.random() - 0.5) * 10,
        vy: -(100 + Math.random() * 100), // Fast downward
        size: 2 + Math.random() * 3,
        life: 0.5 + Math.random() * 0.5,
        type: 'environment',
        colorIndex: 2 // Foam white for rain
      });
    }
  }

  spawnRipples() {
    // Ripple effects on "ground" (bottom of screen)
    const count = this.chargeLevel >= ChargeState.AVATAR ? 3 : 1;

    for (let i = 0; i < count; i++) {
      const screenX = (0.2 + Math.random() * 0.6) * this.particles.scene.getWidth();
      const screenY = 30 + Math.random() * 40;

      // Ripple expands outward
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2;
        const speed = 30 + Math.random() * 20;

        this.particles.spawn({
          x: screenX,
          y: screenY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.3, // Flatten for perspective
          size: 2 + Math.random() * 2,
          life: 0.6 + Math.random() * 0.3,
          type: 'environment',
          colorIndex: 2 // Foam white
        });
      }
    }
  }

  onSlowMove(poseData) {
    super.onSlowMove(poseData);

    // Water trail: silk ribbon-like flow, foam spray particles
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Ribbon-like trail particles
        for (let i = 0; i < 5; i++) {
          const wave = Math.sin(this.wavePhase + i * 0.5) * 10;

          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 20,
            y: screenY + (Math.random() - 0.5) * 20,
            vx: -dir.x * 30 + wave,
            vy: dir.y * 30 - 15, // Slight downward pull
            size: 3 + Math.random() * 5,
            life: 0.7 + Math.random() * 0.4,
            type: 'trail',
            colorIndex: Math.random() < 0.6 ? 0 : 1 // Prussian blue and indigo
          });
        }

        // Foam spray
        for (let i = 0; i < 2; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 30,
            y: screenY + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 50,
            vy: Math.random() * 30,
            size: 1 + Math.random() * 2,
            life: 0.3 + Math.random() * 0.2,
            type: 'trail',
            colorIndex: 2 // Foam white
          });
        }
      }
    });
  }

  onFastMove(poseData, releaseData) {
    super.onFastMove(poseData, releaseData);

    // Water release: wave crashes outward with iconic Hokusai curl pattern
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Main wave
        const waveCount = 20 + releaseData.level * 15;
        for (let i = 0; i < waveCount; i++) {
          // Hokusai wave curl pattern
          const spread = (i / waveCount - 0.5) * 2;
          const curl = Math.sin(spread * Math.PI) * 0.5;

          this.particles.spawn({
            x: screenX,
            y: screenY,
            vx: (dir.x + spread * 0.3) * 150 * releaseData.level,
            vy: (-dir.y + curl) * 150 * releaseData.level,
            size: this.particles.randomSize() * (1 + releaseData.level * 0.2),
            life: 0.8 + Math.random() * 0.4,
            type: 'projectile',
            colorIndex: Math.random() < 0.7 ? 0 : 1
          });
        }

        // Foam spray on top of wave
        for (let i = 0; i < releaseData.level * 10; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 40,
            y: screenY + (Math.random() - 0.5) * 40,
            vx: dir.x * 100 + (Math.random() - 0.5) * 100,
            vy: -dir.y * 100 + Math.random() * 50,
            size: 1 + Math.random() * 3,
            life: 0.4 + Math.random() * 0.3,
            type: 'projectile',
            colorIndex: 2 // Foam white
          });
        }
      }
    });
  }

  getHandVelocityX() {
    return Math.sin(this.wavePhase) * 20;
  }

  getHandVelocityY() {
    return -(15 + Math.random() * 20); // Downward for water
  }
}
