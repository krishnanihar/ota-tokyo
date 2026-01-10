// Fire Element - Edo Fire Scroll Style
// Fire flows UPWARD, fast and volatile, quick burn-out

import { ElementBase } from './ElementBase.js';
import { ChargeState } from '../config.js';

export class FireElement extends ElementBase {
  constructor(particleSystem, segmentationMask) {
    super('fire', particleSystem, segmentationMask);

    // Fire-specific properties
    this.emberTimer = 0;
    this.emberInterval = 0.1;
    this.flickerPhase = 0;
  }

  update(deltaTime, poseData) {
    super.update(deltaTime, poseData);

    if (!this.isActive) return;

    // Update flicker animation
    this.flickerPhase += deltaTime * 8;

    // Spawn floating embers at high charge
    if (this.chargeLevel >= ChargeState.POWER) {
      this.emberTimer += deltaTime;
      if (this.emberTimer >= this.emberInterval) {
        this.emberTimer = 0;
        this.spawnEmbers();
      }
    }
  }

  spawnInternalParticles(poseData) {
    // Fire particles flow upward with organic turbulence (not straight up)
    const rate = this.chargeLevel * 3;

    for (let i = 0; i < rate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Organic turbulent upward flow - like real fire licking upward
      // Use position-based noise for coherent flow patterns
      const noiseX = point.x * 5 + this.flickerPhase * 0.5;
      const noiseY = point.y * 5 + this.flickerPhase * 0.3;

      // Turbulent horizontal drift (like fire flickering side to side)
      const turbulence = Math.sin(noiseX) * Math.cos(noiseY * 1.7) * 25;
      const secondaryTurbulence = Math.sin(noiseX * 2.3 + noiseY) * 15;

      // Upward velocity varies by position (hotter core rises faster)
      const coreDistance = Math.abs(point.x - 0.5) * 2; // 0 at center, 1 at edges
      const upwardSpeed = 25 + (1 - coreDistance) * 30 + Math.random() * 20;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: turbulence + secondaryTurbulence + (Math.random() - 0.5) * 10,
        vy: upwardSpeed, // Organic upward flow
        size: this.particles.randomSize() * 0.6,
        life: 0.5 + Math.random() * 0.5,
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.7 ? 0 : 1 // More primary (vermillion)
      });
    }
  }

  spawnAuraParticles(poseData) {
    // Fire aura: organic flame tongues licking upward around body
    const edgePoints = this.mask?.getEdgePoints(40) || [];
    const intensity = (this.chargeLevel - 1) / 3;

    // Focus more on top half of body for rising flames
    const upperPoints = edgePoints.filter(p => p.y < 0.6);

    for (let i = 0; i < upperPoints.length * intensity * 0.4; i++) {
      const idx = Math.floor(Math.random() * upperPoints.length);
      const point = upperPoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Organic flame tongue - uses turbulent noise, not just sin wave
      const noisePhase = this.flickerPhase + point.x * 8 + point.y * 4;
      const turbulentFlicker = Math.sin(noisePhase) * Math.cos(noisePhase * 0.7) * 20;
      const outwardDrift = (point.x - 0.5) * 15; // Gentle outward spread

      // Upward speed with variation (flames are uneven)
      const upwardBase = 35 + Math.sin(noisePhase * 1.3) * 15;

      this.particles.spawn({
        x: screenX + (Math.random() - 0.5) * 8,
        y: screenY,
        vx: outwardDrift + turbulentFlicker + (Math.random() - 0.5) * 15,
        vy: upwardBase + Math.random() * 25, // Organic upward
        size: this.particles.randomSize(),
        life: 0.4 + Math.random() * 0.3,
        type: 'aura',
        colorIndex: Math.random() < 0.6 ? 0 : 1 // Vermillion with gold accents
      });
    }
  }

  spawnEmbers() {
    // Floating embers rise from ground and around body
    const count = this.chargeLevel >= ChargeState.AVATAR ? 5 : 2;

    for (let i = 0; i < count; i++) {
      // Spawn from bottom of screen or near body
      const fromGround = Math.random() < 0.5;
      const screenX = fromGround
        ? Math.random() * this.particles.scene.getWidth()
        : (0.3 + Math.random() * 0.4) * this.particles.scene.getWidth();
      const screenY = fromGround
        ? 20 + Math.random() * 50
        : Math.random() * this.particles.scene.getHeight() * 0.5;

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: (Math.random() - 0.5) * 30,
        vy: 20 + Math.random() * 30,
        size: 2 + Math.random() * 4,
        life: 1 + Math.random() * 1.5,
        type: 'environment',
        colorIndex: 1 // Gold ochre for embers
      });
    }
  }

  onSlowMove(poseData) {
    super.onSlowMove(poseData);

    // Fire trail: comet tail effect with scattered gold leaf embers
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Extra ember particles in trail
        for (let i = 0; i < 3; i++) {
          this.particles.spawn({
            x: screenX + (Math.random() - 0.5) * 30,
            y: screenY + (Math.random() - 0.5) * 30,
            vx: -dir.x * 20 + (Math.random() - 0.5) * 40,
            vy: dir.y * 20 + 20 + Math.random() * 20, // Tend upward
            size: 2 + Math.random() * 3,
            life: 0.5 + Math.random() * 0.5,
            type: 'trail',
            colorIndex: 1 // Gold embers
          });
        }
      }
    });
  }

  onFastMove(poseData, releaseData) {
    super.onFastMove(poseData, releaseData);

    // Fire release: burst with ember explosion
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands[side];
      if (hand?.palm && hand.palm.visibility > 0.5) {
        const screenX = hand.palm.x * this.particles.scene.getWidth();
        const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

        // Ember explosion
        this.particles.spawnBurst(screenX, screenY, releaseData.level * 15, {
          speed: 100 + releaseData.level * 30,
          directionX: dir.x,
          directionY: -dir.y,
          life: 0.6 + releaseData.level * 0.2,
          type: 'projectile'
        });
      }
    });
  }

  getHandVelocityX() {
    // Slight outward spread
    return (Math.random() - 0.5) * 20;
  }

  getHandVelocityY() {
    // Upward bias for fire
    return 20 + Math.random() * 30;
  }
}
