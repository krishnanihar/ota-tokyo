// Element Base Class - Shared behavior for all elements
// DRAMATICALLY ENHANCED for intense visual effects
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

    // Timing - VERY fast spawn rates for dramatic effect
    this.spawnTimer = 0;
    this.spawnInterval = 0.008; // 120fps particle spawning!
    this.ambientTimer = 0;
    this.ambientInterval = 0.025; // Ambient particles every 25ms
    this.burstTimer = 0;
    this.burstInterval = 0.1; // Periodic bursts
  }

  activate() {
    this.isActive = true;
    this.particles.setElement(this.type);
    console.log(`${this.type} element activated - DRAMATIC MODE`);
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
    this.burstTimer += deltaTime;

    // ALWAYS spawn ambient particles - LOTS of them
    if (this.ambientTimer >= this.ambientInterval) {
      this.ambientTimer = 0;
      this.spawnAmbientParticles();
    }

    // Periodic dramatic bursts
    if (this.burstTimer >= this.burstInterval) {
      this.burstTimer = 0;
      this.spawnEnvironmentBurst();
    }

    // If we have pose data, spawn even more particles
    if (poseData) {
      // Spawn internal body particles at very high rate
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;

        // MANY base particles even at no charge
        const baseRate = 8;
        // MASSIVE bonus at higher charge
        const chargeBonus = this.chargeLevel * 15;
        this.spawnInternalParticles(poseData, baseRate + chargeBonus);
      }

      // Spawn hand particles - ALWAYS when hands visible
      this.spawnHandParticles(poseData);

      // Spawn aura even at no charge (subtle), dramatic at higher charge
      this.spawnAuraParticles(poseData);
    }
  }

  spawnAmbientParticles() {
    // Many small ambient particles
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();

    // Spawn LOTS of small ambient particles
    const count = 20 + Math.floor(Math.random() * 15) + this.chargeLevel * 5;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      // Spawn across full screen height with bias toward edges
      const y = Math.random() < 0.6
        ? Math.random() * height * 0.3 // Bottom
        : height * 0.7 + Math.random() * height * 0.3; // Top

      // Direction based on element
      let vx = 0, vy = 0;
      switch (this.behavior.particleDirection) {
        case 'up':
          vy = 40 + Math.random() * 80;
          vx = (Math.random() - 0.5) * 40;
          break;
        case 'down':
          vy = -(35 + Math.random() * 60);
          vx = (Math.random() - 0.5) * 35;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 50;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
        default:
          vx = (Math.random() - 0.5) * 30;
          vy = (Math.random() - 0.5) * 30;
      }

      this.particles.spawn({
        x,
        y,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 2 + Math.random() * 6, // SMALLER ambient particles
        life: 1.5 + Math.random() * 2.5,
        type: 'ambient',
        colorIndex: Math.floor(Math.random() * 3),
        alpha: 0.4 + Math.random() * 0.4
      });
    }
  }

  spawnEnvironmentBurst() {
    // Periodic dramatic burst from random location
    const width = this.particles.scene.getWidth();
    const height = this.particles.scene.getHeight();
    const burstX = Math.random() * width;
    const burstY = Math.random() * height * 0.4;

    const burstCount = 5 + this.chargeLevel * 3;

    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;

      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;

      // Bias toward element direction
      if (this.behavior.particleDirection === 'up') vy += 40;
      if (this.behavior.particleDirection === 'down') vy -= 40;

      this.particles.spawn({
        x: burstX,
        y: burstY,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 10 + Math.random() * 15,
        life: 1 + Math.random() * 1,
        type: 'ambient',
        colorIndex: Math.floor(Math.random() * 3),
        alpha: 0.7 + Math.random() * 0.3
      });
    }
  }

  spawnInternalParticles(poseData, rate) {
    // Spawn MORE but SMALLER internal particles
    const actualRate = rate * 2;  // Double the rate

    for (let i = 0; i < actualRate; i++) {
      const point = this.mask?.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Direction based on element
      let vx = 0, vy = 0;
      switch (this.behavior.particleDirection) {
        case 'up':
          vy = 60 + Math.random() * 100;
          vx = (Math.random() - 0.5) * 50;
          break;
        case 'down':
          vy = -(50 + Math.random() * 80);
          vx = (Math.random() - 0.5) * 50;
          break;
        case 'center':
          // Gravitate toward center - handled in particle update
          vx = (Math.random() - 0.5) * 25;
          vy = (Math.random() - 0.5) * 25;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 50;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
      }

      this.particles.spawn({
        x: screenX,
        y: screenY,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 3 + Math.random() * 8, // SMALLER particles
        life: 0.8 + Math.random() * 0.8,
        type: 'internal',
        insideBody: true,
        colorIndex: Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2
      });
    }
  }

  spawnHandParticles(poseData) {
    // Spawn LOTS of small particles at hands
    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.3) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // MANY small hand particles
      const baseCount = 12;
      // MORE at higher charge
      const chargeCount = this.chargeLevel * 15;
      const totalCount = baseCount + chargeCount;

      for (let i = 0; i < totalCount; i++) {
        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 50,
          y: screenY + (Math.random() - 0.5) * 50,
          vx: this.getHandVelocityX() * 2,
          vy: this.getHandVelocityY() * 2,
          size: 3 + Math.random() * 7 + this.chargeLevel * 1.5, // SMALLER
          life: 0.4 + Math.random() * 0.4 + this.chargeLevel * 0.1,
          type: 'hand',
          colorIndex: Math.random() < 0.7 ? 0 : 1
        });
      }
    });
  }

  spawnAuraParticles(poseData) {
    const edgePoints = this.mask?.getEdgePoints(80) || [];
    if (edgePoints.length === 0) return;

    // LOTS of small aura particles
    const baseIntensity = 0.3;
    const chargeIntensity = (this.chargeLevel / ChargeState.AVATAR) * 1.0;
    const intensity = baseIntensity + chargeIntensity;
    const count = Math.floor(edgePoints.length * intensity * 1.2);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];
      if (!point) continue;

      const screenX = point.x * this.particles.scene.getWidth();
      const screenY = (1 - point.y) * this.particles.scene.getHeight();

      // Outward velocity based on element
      let vx = (Math.random() - 0.5) * 80;
      let vy;

      if (this.behavior.particleDirection === 'up') {
        vy = 50 + Math.random() * 70;
      } else if (this.behavior.particleDirection === 'down') {
        vy = -(50 + Math.random() * 70);
      } else {
        vy = (Math.random() - 0.5) * 80;
      }

      this.particles.spawn({
        x: screenX + (Math.random() - 0.5) * 15,
        y: screenY + (Math.random() - 0.5) * 15,
        vx: vx * this.behavior.speed,
        vy: vy * this.behavior.speed,
        size: 2 + Math.random() * 6 + this.chargeLevel * 1, // SMALLER
        life: 0.5 + Math.random() * 0.5,
        type: 'aura',
        colorIndex: Math.random() < 0.6 ? 0 : 1
      });
    }
  }

  onSlowMove(poseData) {
    // Create flowing trail with MANY small particles
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // MANY small trail particles
      const count = 25 + this.chargeLevel * 20;

      for (let i = 0; i < count; i++) {
        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 60,
          y: screenY + (Math.random() - 0.5) * 60,
          vx: -dir.x * 120 + (Math.random() - 0.5) * 80,
          vy: dir.y * 120 + this.getHandVelocityY(),
          size: 3 + Math.random() * 8, // SMALLER particles
          life: 0.6 + Math.random() * 0.6,
          type: 'trail',
          colorIndex: Math.random() < 0.5 ? 0 : 1,
          alpha: 0.6 + Math.random() * 0.3
        });
      }
    });
  }

  onFastMove(poseData, releaseData) {
    // EXPLOSIVE projectile burst with MANY small particles
    const dir = poseData.movementDirection;

    ['left', 'right'].forEach(side => {
      const hand = poseData.hands?.[side];
      if (!hand?.palm || hand.palm.visibility < 0.5) return;

      const screenX = hand.palm.x * this.particles.scene.getWidth();
      const screenY = (1 - hand.palm.y) * this.particles.scene.getHeight();

      // MASSIVE burst with small particles - MORE POWERFUL
      const count = 80 + releaseData.level * 50;
      const power = releaseData.level * this.behavior.releaseForce * 1.5; // BOOSTED power

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.5;
        const speedVariation = 0.7 + Math.random() * 0.6;

        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 30,
          y: screenY + (Math.random() - 0.5) * 30,
          vx: (dir.x + spread) * 500 * power * speedVariation,
          vy: (-dir.y + spread) * 500 * power * speedVariation,
          size: 4 + Math.random() * 10 + releaseData.level * 2, // SMALLER but more
          life: 0.8 + Math.random() * 0.6,
          type: 'projectile',
          colorIndex: Math.floor(Math.random() * 3),
          alpha: 0.7 + Math.random() * 0.3
        });
      }

      // Add secondary wave of even smaller particles for density
      for (let i = 0; i < count * 0.5; i++) {
        const spread = (Math.random() - 0.5) * 0.8;
        const speedVariation = 0.5 + Math.random() * 0.5;

        this.particles.spawn({
          x: screenX + (Math.random() - 0.5) * 50,
          y: screenY + (Math.random() - 0.5) * 50,
          vx: (dir.x + spread) * 350 * power * speedVariation,
          vy: (-dir.y + spread) * 350 * power * speedVariation,
          size: 2 + Math.random() * 5,
          life: 0.5 + Math.random() * 0.4,
          type: 'projectile',
          colorIndex: Math.floor(Math.random() * 3),
          alpha: 0.5 + Math.random() * 0.3
        });
      }
    });
  }

  // Override in subclasses for element-specific velocity
  getHandVelocityX() {
    return (Math.random() - 0.5) * 80;
  }

  getHandVelocityY() {
    return (Math.random() - 0.5) * 80;
  }

  getColors() {
    return this.colors;
  }

  getBehavior() {
    return this.behavior;
  }
}
