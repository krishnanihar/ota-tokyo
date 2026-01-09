// Air Element - Rinpa Cloud Style
// Air constantly SWIRLS, instant weightless speed, quick scatter

import { ElementBase } from './ElementBase.js';
import { ChargeState } from '../config.js';

export class AirElement extends ElementBase {
  constructor(particleSystem, segmentationMask) {
    super('air', particleSystem, segmentationMask);

    // Air-specific properties
    this.swirlPhase = 0;
    this.petalTimer = 0;
    this.petalInterval = 0.08;
    this.windTimer = 0;
    this.windInterval = 0.05;
  }

  update(deltaTime, poseData) {
    super.update(deltaTime, poseData);

    if (!this.isActive) return;

    // Update swirl animation (faster than others)
    this.swirlPhase += deltaTime * 4;

    // Spawn cherry blossoms / autumn leaves at high charge
    if (this.chargeLevel >= ChargeState.FORM) {
      this.petalTimer += deltaTime;
      if (this.petalTimer >= this.petalInterval) {
        this.petalTimer = 0;
        this.spawnPetals();
      }
    }

    // Spawn wind streaks at power level
    if (this.chargeLevel >= ChargeState.POWER) {
      this.windTimer += deltaTime;
      if (this.windTimer >= this.windInterval) {
        this.windTimer = 0;
        this.spawnWindStreaks();
      }
    }
  }

  spawnInternalParticles(poseData) {
    // Air particles swirl constantly inside body, never settle
    const rate = this.chargeLevel * 4; // Most particles of all elements

    for (let i = 0; i < rate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Swirling motion
      const swirlAngle = this.swirlPhase + point.x * 10 + point.y * 10;
      const swirlSpeed = 30 + Math.random() * 20;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: Math.cos(swirlAngle) * swirlSpeed,
        vy: Math.sin(swirlAngle) * swirlSpeed,
        size: this.particles.randomSize() * 0.5, // Smaller, lighter
        life: 0.4 + Math.random() * 0.3, // Quick, ephemeral
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : 2) // Mix of all colors
      });
    }
  }

  spawnAuraParticles(poseData) {
    // Air aura: full cyclone forms around body
    const edgePoints = this.mask?.getEdgePoints(50) || [];
    const intensity = (this.chargeLevel - 1) / 3;

    for (let i = 0; i < edgePoints.length * intensity * 0.4; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Cyclone motion - circular around body
      const cycloneAngle = this.swirlPhase + i * 0.3;
      const cycloneSpeed = 50 + Math.random() * 30;

      this.particles.spawn({
        x: screenX + Math.cos(cycloneAngle) * 20,
        y: screenY + Math.sin(cycloneAngle) * 20,
        vx: Math.cos(cycloneAngle + Math.PI / 2) * cycloneSpeed,
        vy: Math.sin(cycloneAngle + Math.PI / 2) * cycloneSpeed,
        size: this.particles.randomSize() * 0.4,
        life: 0.3 + Math.random() * 0.2,
        type: 'aura',
        colorIndex: Math.random() < 0.7 ? 0 : 2 // Silver mist and pale gold
      });
    }
  }

  spawnPetals() {
    // Cherry blossom petals / autumn leaves floating
    const count = this.chargeLevel >= ChargeState.AVATAR ? 6 : 3;

    for (let i = 0; i < count; i++) {
      // Spawn from edges of screen, floating inward
      const fromLeft = Math.random() < 0.5;
      const screenX = fromLeft
        ? -20 + Math.random() * 50
        : this.particles.scene.getWidth() - 30 + Math.random() * 50;
      const screenY = Math.random() * this.particles.scene.getHeight();

      // Gentle floating motion with swirl
      const baseVx = fromLeft ? 30 : -30;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: baseVx + Math.sin(this.swirlPhase + i) * 20,
        vy: Math.cos(this.swirlPhase * 0.5 + i) * 15,
        size: 3 + Math.random() * 4,
        life: 2 + Math.random() * 1, // Float across screen
        type: 'environment',
        colorIndex: 2, // Pale gold (cherry blossom color)
        rotationSpeed: (Math.random() - 0.5) * 5 // Spinning petals
      });
    }
  }

  spawnWindStreaks() {
    // Wind streak lines across screen
    const count = this.chargeLevel >= ChargeState.AVATAR ? 4 : 2;

    for (let i = 0; i < count; i++) {
      const screenX = Math.random() * this.particles.scene.getWidth();
      const screenY = Math.random() * this.particles.scene.getHeight();

      // Wind direction with slight variation
      const windAngle = Math.PI * 0.15 + (Math.random() - 0.5) * 0.3;
      const windSpeed = 100 + Math.random() * 50;

      // Line of particles for streak effect
      for (let j = 0; j < 4; j++) {
        this.particles.spawn({
          x: screenX - Math.cos(windAngle) * j * 10,
          y: screenY - Math.sin(windAngle) * j * 10,
          vx: Math.cos(windAngle) * windSpeed,
          vy: Math.sin(windAngle) * windSpeed,
          size: 1 + (3 - j) * 0.5, // Tapers off
          life: 0.2 + Math.random() * 0.1,
          type: 'environment',
          colorIndex: 0 // Silver mist
        });
      }
    }
  }

  onSlowMove(poseData) {
    super.onSlowMove(poseData);

    // Air trail: wind streaks, particles scatter in all directions
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Scattering particles in all directions
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + this.swirlPhase;
          const speed = 30 + Math.random() * 40;

          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 20,
            y: screenY + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed - dir.x * 20,
            vy: Math.sin(angle) * speed + dir.y * 20,
            size: 1 + Math.random() * 3,
            life: 0.3 + Math.random() * 0.2,
            type: 'trail',
            colorIndex: Math.random() < 0.6 ? 0 : 1
          });
        }
      }
    });
  }

  onFastMove(poseData, releaseData) {
    super.onFastMove(poseData, releaseData);

    // Air release: expanding gust wave, wide spread, pushes all particles
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Wide expanding wave
        const waveCount = 30 + releaseData.level * 20;
        for (let i = 0; i < waveCount; i++) {
          // Wide spread angle
          const spreadAngle = ((i / waveCount) - 0.5) * Math.PI;
          const baseAngle = Math.atan2(-dir.y, dir.x);
          const angle = baseAngle + spreadAngle;

          const speed = 150 + Math.random() * 100;

          this.particles.spawn({
            x: screenX,
            y: screenY,
            vx: Math.cos(angle) * speed * releaseData.level,
            vy: Math.sin(angle) * speed * releaseData.level,
            size: 1 + Math.random() * 3,
            life: 0.4 + Math.random() * 0.2,
            type: 'projectile',
            colorIndex: Math.random() < 0.5 ? 0 : 1
          });
        }

        // Central gust burst
        this.particles.spawnBurst(screenX, screenY, releaseData.level * 15, {
          speed: 200 * releaseData.level,
          directionX: dir.x,
          directionY: -dir.y,
          life: 0.3,
          size: 2
        });

        // Swirling debris caught in wind
        for (let i = 0; i < releaseData.level * 8; i++) {
          const swirlAngle = this.swirlPhase + i * 0.5;

          this.particles.spawn({
            x: screenX + Math.cos(swirlAngle) * 30,
            y: screenY + Math.sin(swirlAngle) * 30,
            vx: dir.x * 120 + Math.cos(swirlAngle) * 50,
            vy: -dir.y * 120 + Math.sin(swirlAngle) * 50,
            size: 2 + Math.random() * 3,
            life: 0.5 + Math.random() * 0.3,
            type: 'projectile',
            colorIndex: 2 // Pale gold (leaves/petals)
          });
        }
      }
    });
  }

  getHandVelocityX() {
    return Math.cos(this.swirlPhase) * 40; // Fast swirl
  }

  getHandVelocityY() {
    return Math.sin(this.swirlPhase) * 40; // Fast swirl
  }
}
