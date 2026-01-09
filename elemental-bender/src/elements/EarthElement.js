// Earth Element - Sumi-e Ink Wash Style
// Earth settles toward CENTER, slow deliberate speed, lingers longest

import { ElementBase } from './ElementBase.js';
import { ChargeState } from '../config.js';

export class EarthElement extends ElementBase {
  constructor(particleSystem, segmentationMask) {
    super('earth', particleSystem, segmentationMask);

    // Earth-specific properties
    this.rumblePhase = 0;
    this.crackTimer = 0;
    this.crackInterval = 0.2;
    this.debrisTimer = 0;
    this.debrisInterval = 0.1;
  }

  update(deltaTime, poseData) {
    super.update(deltaTime, poseData);

    if (!this.isActive) return;

    // Update rumble animation
    this.rumblePhase += deltaTime * 1.5;

    // Spawn floating debris at high charge
    if (this.chargeLevel >= ChargeState.FORM) {
      this.debrisTimer += deltaTime;
      if (this.debrisTimer >= this.debrisInterval) {
        this.debrisTimer = 0;
        this.spawnDebris(poseData);
      }
    }

    // Spawn ground cracks at power level
    if (this.chargeLevel >= ChargeState.POWER) {
      this.crackTimer += deltaTime;
      if (this.crackTimer >= this.crackInterval) {
        this.crackTimer = 0;
        this.spawnCracks();
      }
    }
  }

  spawnInternalParticles(poseData) {
    // Earth particles settle toward body's center
    const rate = this.chargeLevel * 2; // Fewer, heavier particles

    for (let i = 0; i < rate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Slow, gravitating toward center (handled in particle system)
      const rumble = Math.sin(this.rumblePhase + i) * 5;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: rumble + (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: this.particles.randomSize() * 0.8, // Larger chunks
        life: 1.5 + Math.random() * 1, // Lingers longest
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? 1 : 2) // Umber, grey, moss
      });
    }
  }

  spawnAuraParticles(poseData) {
    // Earth aura: pebbles levitate around feet and body
    const edgePoints = this.mask?.getEdgePoints(30) || [];
    const intensity = (this.chargeLevel - 1) / 3;

    for (let i = 0; i < edgePoints.length * intensity * 0.2; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Slow levitation with slight wobble
      const wobble = Math.sin(this.rumblePhase * 0.5 + i) * 3;

      this.particles.spawn({
        x: screenX + (Math.random() - 0.5) * 30,
        y: screenY + (Math.random() - 0.5) * 30,
        vx: wobble,
        vy: 5 + Math.random() * 10, // Slow upward levitation
        size: this.particles.randomSize() * 1.2, // Larger chunks
        life: 0.8 + Math.random() * 0.5,
        type: 'aura',
        colorIndex: Math.floor(Math.random() * 3) // All colors
      });
    }
  }

  spawnDebris(poseData) {
    // Floating rocks around body
    const count = this.chargeLevel >= ChargeState.AVATAR ? 4 : 2;
    const bodyCenter = poseData?.bodyCenter;

    for (let i = 0; i < count; i++) {
      // Orbit around body center
      let screenX, screenY;

      if (bodyCenter) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 100;
        screenX = bodyCenter.x * this.particles.scene.getWidth() + Math.cos(angle) * radius;
        screenY = (1 - bodyCenter.y) * this.particles.scene.getHeight() + Math.sin(angle) * radius;
      } else {
        screenX = (0.2 + Math.random() * 0.6) * this.particles.scene.getWidth();
        screenY = Math.random() * this.particles.scene.getHeight();
      }

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: (Math.random() - 0.5) * 20,
        vy: 3 + Math.random() * 8, // Slow levitation
        size: 5 + Math.random() * 10, // Large chunks
        life: 1.5 + Math.random() * 1,
        type: 'environment',
        colorIndex: Math.random() < 0.7 ? 0 : 1 // Umber and grey
      });
    }
  }

  spawnCracks() {
    // Seismic crack patterns on ground
    const count = this.chargeLevel >= ChargeState.AVATAR ? 4 : 2;

    for (let i = 0; i < count; i++) {
      const screenX = (0.1 + Math.random() * 0.8) * this.particles.scene.getWidth();
      const screenY = 20 + Math.random() * 60;

      // Crack line particles
      const angle = (Math.random() - 0.5) * Math.PI * 0.5;
      for (let j = 0; j < 5; j++) {
        const dist = j * 10;

        this.particles.spawn({
          x: screenX + Math.cos(angle) * dist,
          y: screenY + Math.sin(angle) * dist * 0.3,
          vx: Math.cos(angle) * 5,
          vy: Math.sin(angle) * 2,
          size: 3 + Math.random() * 3,
          life: 1 + Math.random() * 0.5,
          type: 'environment',
          colorIndex: 0 // Umber for cracks
        });
      }
    }
  }

  onSlowMove(poseData) {
    super.onSlowMove(poseData);

    // Earth trail: heavy chunks follow slowly, dust cloud lingers
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Heavy rock chunks
        for (let i = 0; i < 2; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 30,
            y: screenY + (Math.random() - 0.5) * 30,
            vx: -dir.x * 15 + (Math.random() - 0.5) * 10, // Slow follow
            vy: dir.y * 15 + (Math.random() - 0.5) * 10,
            size: 6 + Math.random() * 8,
            life: 1.2 + Math.random() * 0.5,
            type: 'trail',
            colorIndex: Math.random() < 0.7 ? 0 : 1
          });
        }

        // Dust particles
        for (let i = 0; i < 4; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 40,
            y: screenY + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            size: 2 + Math.random() * 3,
            life: 0.8 + Math.random() * 0.4,
            type: 'trail',
            colorIndex: 1 // Warm grey for dust
          });
        }
      }
    });
  }

  onFastMove(poseData, releaseData) {
    super.onFastMove(poseData, releaseData);

    // Earth release: boulder chunks shoot out, shatter on invisible impact
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Large boulder chunks
        const boulderCount = 5 + releaseData.level * 5;
        for (let i = 0; i < boulderCount; i++) {
          const spread = (Math.random() - 0.5) * 0.4;
          const speed = 80 + Math.random() * 40; // Slower than other elements

          this.particles.spawn({
            x: screenX,
            y: screenY,
            vx: (dir.x + spread) * speed * releaseData.level,
            vy: (-dir.y + spread) * speed * releaseData.level,
            size: 8 + Math.random() * 12, // Large chunks
            life: 1 + Math.random() * 0.5,
            type: 'projectile',
            colorIndex: Math.random() < 0.6 ? 0 : 1
          });
        }

        // Smaller debris following
        for (let i = 0; i < releaseData.level * 10; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 50,
            y: screenY + (Math.random() - 0.5) * 50,
            vx: dir.x * 60 + (Math.random() - 0.5) * 60,
            vy: -dir.y * 60 + (Math.random() - 0.5) * 60,
            size: 2 + Math.random() * 4,
            life: 0.8 + Math.random() * 0.4,
            type: 'projectile',
            colorIndex: 1 // Warm grey debris
          });
        }

        // Dust cloud
        this.particles.spawnBurst(screenX, screenY, releaseData.level * 8, {
          speed: 40,
          directionX: dir.x,
          directionY: -dir.y,
          life: 0.6,
          size: 3
        });
      }
    });
  }

  getHandVelocityX() {
    return (Math.random() - 0.5) * 10; // Slow, deliberate
  }

  getHandVelocityY() {
    return (Math.random() - 0.5) * 10; // Gravitates to center
  }
}
