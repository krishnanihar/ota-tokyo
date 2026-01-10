// Background Effects - Ambient particles and atmospheric elements
import * as THREE from 'three';
import { CONFIG, COLORS, hexToRgb } from '../config.js';

export class BackgroundEffects {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.particles = null;
    this.geometry = null;
    this.material = null;

    // Settings - subtle background particles
    this.particleCount = Math.floor((CONFIG.BG_PARTICLE_COUNT || 100) * 0.4); // 40% of original count
    this.baseSpeed = (CONFIG.BG_PARTICLE_SPEED || 20) * 0.6; // Slower movement

    // Particle data
    this.positions = null;
    this.velocities = null;
    this.sizes = null;
    this.colors = null;
    this.lifetimes = null;

    // Current state
    this.currentElement = 'fire';
    this.time = 0;
    this.width = 0;
    this.height = 0;
  }

  initialize(width, height) {
    this.width = width;
    this.height = height;

    this.createParticles();
    console.log(`BackgroundEffects: Initialized with ${this.particleCount} ambient particles`);
  }

  createParticles() {
    // Pre-allocate arrays
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 2);
    this.sizes = new Float32Array(this.particleCount);
    this.colors = new Float32Array(this.particleCount * 3);
    this.lifetimes = new Float32Array(this.particleCount);

    // Initialize particles randomly across screen
    for (let i = 0; i < this.particleCount; i++) {
      this.resetParticle(i, true);
    }

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Material with very subtle glow - barely visible ambient effect
    this.material = new THREE.PointsMaterial({
      size: 2,  // Smaller
      vertexColors: true,
      transparent: true,
      opacity: 0.15,  // Much more subtle
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.frustumCulled = false;

    // Background layer (behind everything)
    this.particles.position.z = -5;

    this.scene.add(this.particles);
  }

  resetParticle(index, randomPosition = false) {
    const posIndex = index * 3;
    const velIndex = index * 2;

    // Position
    if (randomPosition) {
      this.positions[posIndex] = Math.random() * this.width;
      this.positions[posIndex + 1] = Math.random() * this.height;
    } else {
      // Spawn at edge based on element direction
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0: // Bottom
          this.positions[posIndex] = Math.random() * this.width;
          this.positions[posIndex + 1] = -20;
          break;
        case 1: // Top
          this.positions[posIndex] = Math.random() * this.width;
          this.positions[posIndex + 1] = this.height + 20;
          break;
        case 2: // Left
          this.positions[posIndex] = -20;
          this.positions[posIndex + 1] = Math.random() * this.height;
          break;
        case 3: // Right
          this.positions[posIndex] = this.width + 20;
          this.positions[posIndex + 1] = Math.random() * this.height;
          break;
      }
    }
    this.positions[posIndex + 2] = -5; // Behind everything

    // Velocity based on element
    const drift = this.getElementDrift();
    this.velocities[velIndex] = drift.x + (Math.random() - 0.5) * this.baseSpeed * 0.5;
    this.velocities[velIndex + 1] = drift.y + (Math.random() - 0.5) * this.baseSpeed * 0.5;

    // Size - very small subtle particles
    this.sizes[index] = 1 + Math.random() * 2;

    // Lifetime
    this.lifetimes[index] = 5 + Math.random() * 10;

    // Color based on element
    this.updateParticleColor(index);
  }

  updateParticleColor(index) {
    const colors = COLORS[this.currentElement];
    const colorIndex = index * 3;

    // Mix of primary and glow colors, muted for background
    const useGlow = Math.random() > 0.7;
    const rgb = hexToRgb(useGlow ? colors.glow : colors.primary);

    // Very dim colors for barely visible background effect
    const brightness = 0.15 + Math.random() * 0.15;
    this.colors[colorIndex] = rgb.r * brightness;
    this.colors[colorIndex + 1] = rgb.g * brightness;
    this.colors[colorIndex + 2] = rgb.b * brightness;
  }

  getElementDrift() {
    // Background particles drift based on element
    const driftPatterns = {
      fire: { x: (Math.random() - 0.5) * 10, y: this.baseSpeed * 0.8 },        // Mostly upward
      water: { x: (Math.random() - 0.5) * 15, y: -this.baseSpeed * 0.6 },      // Mostly downward
      earth: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 },   // Floating
      air: { x: this.baseSpeed * 0.5, y: (Math.random() - 0.5) * 20 }          // Horizontal wind
    };

    return driftPatterns[this.currentElement] || driftPatterns.fire;
  }

  setElement(elementType) {
    this.currentElement = elementType;

    // Update all particle colors
    for (let i = 0; i < this.particleCount; i++) {
      this.updateParticleColor(i);
    }

    this.geometry.attributes.color.needsUpdate = true;
  }

  update(time, deltaTime) {
    this.time = time;

    if (!deltaTime) return;

    for (let i = 0; i < this.particleCount; i++) {
      const posIndex = i * 3;
      const velIndex = i * 2;

      // Update lifetime
      this.lifetimes[i] -= deltaTime;

      // Reset if expired or out of bounds
      if (this.lifetimes[i] <= 0 || this.isOutOfBounds(i)) {
        this.resetParticle(i, false);
        continue;
      }

      // Apply velocity
      this.positions[posIndex] += this.velocities[velIndex] * deltaTime;
      this.positions[posIndex + 1] += this.velocities[velIndex + 1] * deltaTime;

      // Add subtle wave motion
      const wave = Math.sin(time * 0.5 + i * 0.3) * deltaTime * 5;
      this.positions[posIndex] += wave;

      // Air element gets extra swirl
      if (this.currentElement === 'air') {
        const swirl = Math.sin(time * 2 + i * 0.5) * deltaTime * 15;
        this.positions[posIndex] += swirl;
        this.positions[posIndex + 1] += Math.cos(time * 1.5 + i * 0.5) * deltaTime * 10;
      }

      // Size pulsing
      const pulse = 0.9 + Math.sin(time * 2 + i) * 0.1;
      this.sizes[i] = (2 + Math.random() * 0.5) * pulse;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  isOutOfBounds(index) {
    const posIndex = index * 3;
    const x = this.positions[posIndex];
    const y = this.positions[posIndex + 1];
    const margin = 50;

    return x < -margin || x > this.width + margin ||
           y < -margin || y > this.height + margin;
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
  }

  dispose() {
    if (this.particles) {
      this.scene.remove(this.particles);
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}
