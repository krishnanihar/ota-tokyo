// Element Base Class - Shared behavior for all elements
import { COLORS, ELEMENT_BEHAVIORS, ChargeState } from '../config.js';

export class ElementBase {
  constructor(type, particleSystem, segmentationMask) {
    this.type = type;
    this.particles = particleSystem;
    this.mask = segmentationMask;
    this.colors = COLORS[type];
    this.behavior = ELEMENT_BEHAVIORS[type];

    // State
    this.chargeLevel = ChargeState.NONE;
    this.isActive = false;

    // Timing - MUCH faster spawn rate
    this.spawnTimer = 0;
    this.spawnInterval = 0.016; // 60fps particle spawning
    this.ambientTimer = 0;
    this.ambientInterval = 0.05; // Ambient particles every 50ms
  }

  activate() {
    this.isActive = true;
    this.particles.setElement(this.type);
    console.log(`${this.type} element activated`);
  }

  deactivate() {
    this.isActive = false;
  }

  setChargeLevel(level) {
    this.chargeLevel = level;
  }

  update(deltaTime, poseData) {
    if (!this.isActive) return;

    this.spawnTimer += deltaTime;
    this.ambientTimer += deltaTime;

    // ALWAYS spawn ambient particles - even without pose
    if (this.ambientTimer >= this.ambientInterval) {
      this.ambientTimer = 0;
      this.spawnAmbientParticles();
    }

    // If we have pose data, spawn more particles
    if (poseData) {
      // Spawn internal body particles - ALWAYS when detected, not just when charging
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;

        // Base particles even at no charge
        const baseRate = 3;
        // Much more particles at higher charge
        const chargeBonus = this.chargeLevel * 8;
        this.spawnInternalParticles(poseData, baseRate + chargeBonus);
      }

      // Spawn hand particles - ALWAYS when hands visible
      this.spawnHandParticles(poseData);

      // Spawn aura at any charge level (intensity varies)
      if (this.chargeLevel >= ChargeState.SPARK) {
        this.spawnAuraParticles(poseData);
      }
    }
  }

  spawnAmbientParticles() {
    // Background environmental particles - always visible
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();

    // Spawn 3-8 ambient particles each interval
    const count = 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.3; // Mostly from bottom

      // Direction based on element
      let vx = 0, vy = 0;
      switch (this.behavior.particleDirection) {
        case 'up':
          vy = 30 + Math.random() * 50;
          vx = (Math.random() - 0.5) * 30;
          break;
        case 'down':
          vy = -(20 + Math.random() * 40);
          vx = (Math.random() - 0.5) * 30;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 30;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
        default:
          vx = (Math.random() - 0.5) * 20;
          vy = (Math.random() - 0.5) * 20;
      }

      this.particles.spawn({
        x,
        y,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 3 + Math.random() * 8, // Larger ambient particles
        life: 1.5 + Math.random() * 2,
        type: 'ambient',
        colorIndex: Math.floor(Math.random() * 3),
        alpha: 0.6 + Math.random() * 0.4
      });
    }
  }

  spawnInternalParticles(poseData, rate) {
    for (let i = 0; i < rate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Direction based on element
      let vx = 0, vy = 0;
      switch (this.behavior.particleDirection) {
        case 'up':
          vy = 50 + Math.random() * 80;
          vx = (Math.random() - 0.5) * 40;
          break;
        case 'down':
          vy = -(40 + Math.random() * 60);
          vx = (Math.random() - 0.5) * 40;
          break;
        case 'center':
          // Gravitate toward center - handled in particle update
          vx = (Math.random() - 0.5) * 20;
          vy = (Math.random() - 0.5) * 20;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 40;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
      }

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 5 + Math.random() * 15, // MUCH larger particles
        life: 0.8 + Math.random() * 0.8,
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2
      });
    }
  }

  spawnHandParticles(poseData) {
    // Spawn particles at hands - ALWAYS when visible
    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.3) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // Base hand particles (always)
      const baseCount = 2;
      // Extra at higher charge
      const chargeCount = this.chargeLevel * 4;
      const totalCount = baseCount + chargeCount;

      for (let i = 0; i < totalCount; i++) {
        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 40,
          y: screenY + (Math.random() - 0.5) * 40,
          vx: this.getHandVelocityX() * 2, // Faster
          vy: this.getHandVelocityY() * 2,
          size: 8 + Math.random() * 15 + this.chargeLevel * 3, // Much larger
          life: 0.4 + Math.random() * 0.4 + this.chargeLevel * 0.1,
          type: 'hand',
          colorIndex: Math.random() < 0.7 ? 0 : 1
        });
      }
    });
  }

  spawnAuraParticles(poseData) {
    const edgePoints = this.mask?.getEdgePoints(50) || [];
    if (edgePoints.length === 0) return;

    // Intensity based on charge - MORE particles
    const intensity = 0.3 + (this.chargeLevel / ChargeState.AVATAR) * 0.7;
    const count = Math.floor(edgePoints.length * intensity * 0.5);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Outward velocity based on element
      let vx = (Math.random() - 0.5) * 60;
      let vy = this.behavior.particleDirection === 'up' ? 40 + Math.random() * 40 : (Math.random() - 0.5) * 60;

      this.particles.spawn({
        x: screenX + (Math.random() - 0.5) * 15,
        y: screenY + (Math.random() - 0.5) * 15,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 6 + Math.random() * 12 + this.chargeLevel * 2,
        life: 0.5 + Math.random() * 0.5,
        type: 'aura',
        colorIndex: 0
      });
    }
  }

  onSlowMove(poseData) {
    // Create INTENSE flowing trail
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // Many more trail particles
      const count = 8 + this.chargeLevel * 5;

      for (let i = 0; i < count; i++) {
        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 30,
          y: screenY + (Math.random() - 0.5) * 30,
          vx: -dir.x * 60 + (Math.random() - 0.5) * 40,
          vy: dir.y * 60 + this.getHandVelocityY(),
          size: 8 + Math.random() * 15,
          life: 0.6 + Math.random() * 0.6,
          type: 'trail',
          colorIndex: Math.random() < 0.5 ? 0 : 1
        });
      }
    });
  }

  onFastMove(poseData, releaseData) {
    // MASSIVE projectile burst
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // Huge burst
      const count = 30 + releaseData.level * 20;

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.5;
        const speedVariation = 0.6 + Math.random() * 0.8;
        const power = releaseData.level * this.behavior.releaseForce;

        this.particles.spawn({
          x: screenX,
          y: screenY,
          vx: (dir.x + spread) * 300 * power * speedVariation,
          vy: (-dir.y + spread) * 300 * power * speedVariation,
          size: 10 + Math.random() * 20 + releaseData.level * 5,
          life: 1 + Math.random() * 0.5,
          type: 'projectile',
          colorIndex: Math.floor(Math.random() * 3)
        });
      }
    });
  }

  // Override in subclasses for element-specific velocity
  getHandVelocityX() {
    return (Math.random() - 0.5) * 50;
  }

  getHandVelocityY() {
    return (Math.random() - 0.5) * 50;
  }

  getColors() {
    return this.colors;
  }

  getBehavior() {
    return this.behavior;
  }
}
