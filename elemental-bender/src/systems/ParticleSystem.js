// Particle System - GPU-optimized particles using instanced meshes
import * as THREE from 'three';
import { CONFIG, COLORS, ELEMENT_BEHAVIORS, hexToRgb } from '../config.js';

export class ParticleSystem {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.particles = [];
    this.particlePool = [];
    this.instancedMesh = null;
    this.maxParticles = CONFIG.MAX_PARTICLES;
    this.activeCount = 0;

    // Reusable objects for performance
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3();
    this.tempColor = new THREE.Color();

    // Element state
    this.currentElement = 'fire';
    this.elementColors = null;
    this.elementBehavior = null;

    // Body mask reference for containment
    this.bodyMask = null;

    // Hand positions for orb spawning
    this.leftHandPos = null;
    this.rightHandPos = null;
  }

  initialize() {
    this.createParticlePool();
    this.createInstancedMesh();
    this.setElement(this.currentElement);
  }

  createParticlePool() {
    // Pre-allocate particle objects to avoid GC during runtime
    for (let i = 0; i < CONFIG.PARTICLE_POOL_SIZE; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 1,
        rotation: 0,
        rotationSpeed: 0,
        life: 0,
        maxLife: 1,
        alpha: 1,
        colorIndex: 0, // 0 = primary, 1 = secondary, 2 = accent
        type: 'normal', // normal, trail, projectile, aura
        insideBody: false
      });
    }
  }

  createInstancedMesh() {
    // Use a simple plane geometry for brush-stroke-like particles
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Custom shader material for particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        primaryColor: { value: new THREE.Color(COLORS.fire.primary) },
        secondaryColor: { value: new THREE.Color(COLORS.fire.secondary) },
        accentColor: { value: new THREE.Color(COLORS.fire.accent) },
        glowColor: { value: new THREE.Color(COLORS.fire.glow) },
        time: { value: 0 }
      },
      vertexShader: `
        attribute vec3 instancePosition;
        attribute float instanceSize;
        attribute float instanceRotation;
        attribute float instanceAlpha;
        attribute float instanceColorIndex;

        varying float vAlpha;
        varying float vColorIndex;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vAlpha = instanceAlpha;
          vColorIndex = instanceColorIndex;

          // Apply rotation
          float c = cos(instanceRotation);
          float s = sin(instanceRotation);
          vec3 rotatedPosition = vec3(
            position.x * c - position.y * s,
            position.x * s + position.y * c,
            position.z
          );

          // Apply scale and position
          vec3 transformed = rotatedPosition * instanceSize + instancePosition;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 accentColor;
        uniform vec3 glowColor;
        uniform float time;

        varying float vAlpha;
        varying float vColorIndex;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          // SOFT GLOWING CIRCLES - smooth falloff for energy feel
          // Soft inner core with gradual fade
          float softCircle = 1.0 - smoothstep(0.0, 0.5, dist);

          // Add slight glow halo around edge
          float halo = smoothstep(0.5, 0.3, dist) * smoothstep(0.1, 0.3, dist) * 0.5;

          float alpha = (softCircle + halo) * vAlpha;

          if (alpha < 0.02) discard;

          // Select color based on index
          vec3 color;
          if (vColorIndex < 0.5) {
            color = primaryColor;
          } else if (vColorIndex < 1.5) {
            color = secondaryColor;
          } else {
            color = accentColor;
          }

          // Bright core, fading to glow color at edges
          float coreBrightness = 1.0 - smoothstep(0.0, 0.35, dist);
          color = mix(color, glowColor, 1.0 - coreBrightness);

          // Boost brightness for additive blending
          color *= 1.2;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending // Additive for glowing energy effect
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxParticles);
    this.instancedMesh.frustumCulled = false;

    // Add instance attributes
    const positions = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);
    const rotations = new Float32Array(this.maxParticles);
    const alphas = new Float32Array(this.maxParticles);
    const colorIndices = new Float32Array(this.maxParticles);

    this.instancedMesh.geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(positions, 3));
    this.instancedMesh.geometry.setAttribute('instanceSize', new THREE.InstancedBufferAttribute(sizes, 1));
    this.instancedMesh.geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
    this.instancedMesh.geometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphas, 1));
    this.instancedMesh.geometry.setAttribute('instanceColorIndex', new THREE.InstancedBufferAttribute(colorIndices, 1));

    // Position at z = 10 to be in front of body
    this.instancedMesh.position.z = 10;

    this.scene.add(this.instancedMesh);
  }

  setElement(elementType) {
    this.currentElement = elementType;
    this.elementColors = COLORS[elementType];
    this.elementBehavior = ELEMENT_BEHAVIORS[elementType];

    // Update shader uniforms
    if (this.instancedMesh?.material?.uniforms) {
      const uniforms = this.instancedMesh.material.uniforms;
      uniforms.primaryColor.value.set(this.elementColors.primary);
      uniforms.secondaryColor.value.set(this.elementColors.secondary);
      uniforms.accentColor.value.set(this.elementColors.accent);
      uniforms.glowColor.value.set(this.elementColors.glow);
    }
  }

  // Spawn a single particle
  spawn(options = {}) {
    // Find inactive particle in pool
    let particle = null;
    for (let i = 0; i < this.particlePool.length; i++) {
      if (!this.particlePool[i].active) {
        particle = this.particlePool[i];
        break;
      }
    }

    if (!particle) {
      // Pool exhausted, reuse oldest
      particle = this.particlePool[this.activeCount % this.particlePool.length];
    }

    // Initialize particle
    particle.active = true;
    particle.x = options.x ?? 0;
    particle.y = options.y ?? 0;
    particle.z = options.z ?? 0;
    particle.vx = options.vx ?? (Math.random() - 0.5) * 2;
    particle.vy = options.vy ?? (Math.random() - 0.5) * 2;
    particle.vz = options.vz ?? 0;
    particle.size = options.size ?? this.randomSize();
    particle.rotation = options.rotation ?? Math.random() * Math.PI * 2;
    particle.rotationSpeed = options.rotationSpeed ?? (Math.random() - 0.5) * 2;
    particle.life = options.life ?? 1;
    particle.maxLife = particle.life;
    particle.alpha = options.alpha ?? 1;
    particle.colorIndex = options.colorIndex ?? Math.floor(Math.random() * 3);
    particle.type = options.type ?? 'normal';
    particle.insideBody = options.insideBody ?? false;

    this.activeCount++;
    return particle;
  }

  // Spawn burst of particles
  spawnBurst(x, y, count, options = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (options.speed ?? 50) * (0.5 + Math.random() * 0.5);

      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed + (options.directionX ?? 0) * 100,
        vy: Math.sin(angle) * speed + (options.directionY ?? 0) * 100,
        size: options.size ?? this.randomSize(),
        life: options.life ?? (0.5 + Math.random() * 0.5),
        type: options.type ?? 'normal',
        insideBody: options.insideBody ?? false
      });
    }
  }

  // Spawn trail following movement
  spawnTrail(x, y, directionX, directionY, intensity = 1) {
    const count = Math.floor(3 * intensity);
    const behavior = this.elementBehavior;

    for (let i = 0; i < count; i++) {
      // Slight spread perpendicular to direction
      const perpX = -directionY;
      const perpY = directionX;
      const spread = (Math.random() - 0.5) * 20;

      this.spawn({
        x: x + perpX * spread,
        y: y + perpY * spread,
        vx: -directionX * 30 * behavior.speed + (Math.random() - 0.5) * 20,
        vy: -directionY * 30 * behavior.speed + (Math.random() - 0.5) * 20,
        size: this.randomSize() * 0.7,
        life: behavior.trailLength * (0.3 + Math.random() * 0.3),
        type: 'trail'
      });
    }
  }

  // Spawn projectile with trailing particles
  spawnProjectile(x, y, directionX, directionY, chargeLevel) {
    const behavior = this.elementBehavior;
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
        size: this.randomSize() * (1 + chargeLevel * 0.3),
        life: 0.8 + Math.random() * 0.4,
        type: 'projectile'
      });
    }
  }

  // Spawn particles inside body silhouette
  spawnInsideBody(bodyPoints, maskChecker, count = 5) {
    const behavior = this.elementBehavior;

    for (let i = 0; i < count; i++) {
      // Try to get a point inside the body
      const point = maskChecker?.getRandomInsidePoint();
      if (!point) continue;

      // Convert to screen coordinates
      const screenX = point.x * this.scene.getWidth();
      const screenY = (1 - point.y) * this.scene.getHeight();

      // Velocity based on element direction
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
          // Will be handled in update based on body center
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
        size: this.randomSize() * 0.5,
        life: 1 + Math.random(),
        type: 'internal',
        insideBody: true
      });
    }
  }

  // Spawn aura particles around body edge
  spawnAura(edgePoints, intensity = 1) {
    const behavior = this.elementBehavior;
    const count = Math.floor(edgePoints.length * intensity * 0.3);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * edgePoints.length);
      const point = edgePoints[idx];

      const screenX = point.x * this.scene.getWidth();
      const screenY = (1 - point.y) * this.scene.getHeight();

      // Outward velocity from body
      const outwardX = (Math.random() - 0.5) * 50;
      const outwardY = -20 - Math.random() * 30; // Mostly upward

      this.spawn({
        x: screenX + (Math.random() - 0.5) * 10,
        y: screenY + (Math.random() - 0.5) * 10,
        vx: outwardX * behavior.speed,
        vy: outwardY * behavior.speed,
        size: this.randomSize() * 0.8,
        life: 0.5 + Math.random() * 0.5,
        type: 'aura',
        colorIndex: 0 // Primary color for aura
      });
    }
  }

  randomSize() {
    const behavior = this.elementBehavior || ELEMENT_BEHAVIORS.fire;
    return behavior.particleSize.min +
           Math.random() * (behavior.particleSize.max - behavior.particleSize.min);
  }

  // Set body mask reference for containment checking
  setBodyMask(maskChecker) {
    this.bodyMask = maskChecker;
  }

  // Update hand positions for orb spawning
  updateHandPositions(hands, mirrorMode = true) {
    if (hands?.left?.palm && hands.left.palm.visibility > 0.3) {
      let screenX = hands.left.palm.x * this.scene.getWidth();
      const screenY = (1 - hands.left.palm.y) * this.scene.getHeight();
      if (mirrorMode) screenX = this.scene.getWidth() - screenX;
      this.leftHandPos = { x: screenX, y: screenY };
    } else {
      this.leftHandPos = null;
    }

    if (hands?.right?.palm && hands.right.palm.visibility > 0.3) {
      let screenX = hands.right.palm.x * this.scene.getWidth();
      const screenY = (1 - hands.right.palm.y) * this.scene.getHeight();
      if (mirrorMode) screenX = this.scene.getWidth() - screenX;
      this.rightHandPos = { x: screenX, y: screenY };
    } else {
      this.rightHandPos = null;
    }
  }

  // Spawn concentrated orb particles at hands
  spawnHandOrbs(chargeLevel) {
    if (chargeLevel <= 0) return;

    const behavior = this.elementBehavior;
    const orbSize = 30 + chargeLevel * 20; // Orb radius grows with charge
    const particleCount = 2 + chargeLevel; // More particles at higher charge

    const spawnOrbAt = (pos) => {
      if (!pos) return;

      for (let i = 0; i < particleCount; i++) {
        // Spawn particles in a concentrated orb pattern
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * orbSize * 0.8;

        // Orbital velocity - particles circle the hand
        const orbitalSpeed = 80 + chargeLevel * 30;
        const tangentX = -Math.sin(angle) * orbitalSpeed;
        const tangentY = Math.cos(angle) * orbitalSpeed;

        // Add element-specific motion
        let vx = tangentX;
        let vy = tangentY;

        switch (behavior.particleDirection) {
          case 'up':
            vy += 20;
            break;
          case 'down':
            vy -= 20;
            break;
          case 'swirl':
            // Extra spiral motion
            vx += Math.sin(angle * 3) * 30;
            vy += Math.cos(angle * 3) * 30;
            break;
        }

        this.spawn({
          x: pos.x + Math.cos(angle) * radius,
          y: pos.y + Math.sin(angle) * radius,
          vx: vx * behavior.speed * 0.5,
          vy: vy * behavior.speed * 0.5,
          size: this.randomSize() * (0.5 + chargeLevel * 0.15),
          life: 0.3 + Math.random() * 0.3,
          type: 'handOrb',
          colorIndex: Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : 2)
        });
      }
    };

    spawnOrbAt(this.leftHandPos);
    spawnOrbAt(this.rightHandPos);
  }

  // Spawn particles that fill the body silhouette with flow
  spawnBodyFill(maskChecker, count = 10, chargeLevel = 1) {
    if (!maskChecker) return;

    const behavior = this.elementBehavior;

    for (let i = 0; i < count; i++) {
      const point = maskChecker.getRandomInsidePoint();
      if (!point) continue;

      const screenX = point.x * this.scene.getWidth();
      const screenY = (1 - point.y) * this.scene.getHeight();

      // Velocity based on element direction (flowing inside body)
      let vx = 0, vy = 0;
      switch (behavior.particleDirection) {
        case 'up':
          vy = 40 + Math.random() * 60;
          vx = (Math.random() - 0.5) * 30;
          break;
        case 'down':
          vy = -(40 + Math.random() * 60);
          vx = (Math.random() - 0.5) * 30;
          break;
        case 'center':
          vx = (Math.random() - 0.5) * 20;
          vy = (Math.random() - 0.5) * 20;
          break;
        case 'swirl':
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 40;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
      }

      this.spawn({
        x: screenX,
        y: screenY,
        vx: vx * behavior.speed,
        vy: vy * behavior.speed,
        size: this.randomSize() * (0.4 + chargeLevel * 0.2),
        life: 0.8 + Math.random() * 0.8,
        type: 'bodyFill',
        insideBody: true,
        colorIndex: Math.random() < 0.6 ? 0 : (Math.random() < 0.7 ? 1 : 2)
      });
    }
  }

  // Check if a screen position is inside the body
  isInsideBody(screenX, screenY) {
    if (!this.bodyMask) return false;

    // Convert screen to normalized coordinates
    const normX = screenX / this.scene.getWidth();
    const normY = 1 - (screenY / this.scene.getHeight());

    return this.bodyMask.isInsideBody(normX, normY);
  }

  update(deltaTime, bodyCenter = null) {
    const decay = this.elementBehavior?.decay ?? 0.95;
    const posAttr = this.instancedMesh.geometry.getAttribute('instancePosition');
    const sizeAttr = this.instancedMesh.geometry.getAttribute('instanceSize');
    const rotAttr = this.instancedMesh.geometry.getAttribute('instanceRotation');
    const alphaAttr = this.instancedMesh.geometry.getAttribute('instanceAlpha');
    const colorAttr = this.instancedMesh.geometry.getAttribute('instanceColorIndex');

    let visibleCount = 0;

    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];

      if (!p.active) continue;

      // Update life
      p.life -= deltaTime;

      if (p.life <= 0) {
        p.active = false;
        this.activeCount = Math.max(0, this.activeCount - 1);
        continue;
      }

      // Apply element-specific behavior
      if (this.elementBehavior?.particleDirection === 'center' && bodyCenter && p.insideBody) {
        // Earth: gravitate toward body center
        const centerX = bodyCenter.x * this.scene.getWidth();
        const centerY = (1 - bodyCenter.y) * this.scene.getHeight();
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          p.vx += (dx / dist) * 20 * deltaTime;
          p.vy += (dy / dist) * 20 * deltaTime;
        }
      }

      if (this.elementBehavior?.particleDirection === 'swirl' && p.insideBody) {
        // Air: add rotational force
        const angle = Math.atan2(p.vy, p.vx) + Math.PI * 0.5;
        p.vx += Math.cos(angle) * 30 * deltaTime;
        p.vy += Math.sin(angle) * 30 * deltaTime;
      }

      // Hand orb attraction - particles orbit around nearest hand
      if (p.type === 'handOrb') {
        let nearestHand = null;
        let minDist = Infinity;

        if (this.leftHandPos) {
          const dx = this.leftHandPos.x - p.x;
          const dy = this.leftHandPos.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestHand = this.leftHandPos;
          }
        }
        if (this.rightHandPos) {
          const dx = this.rightHandPos.x - p.x;
          const dy = this.rightHandPos.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestHand = this.rightHandPos;
          }
        }

        if (nearestHand && minDist > 5) {
          // Centripetal force toward hand
          const dx = nearestHand.x - p.x;
          const dy = nearestHand.y - p.y;
          const force = 400 / Math.max(minDist, 30);
          p.vx += (dx / minDist) * force * deltaTime;
          p.vy += (dy / minDist) * force * deltaTime;
        }
      }

      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;

      // Body containment - bounce particles back inside if they leave
      if (p.insideBody && this.bodyMask) {
        if (!this.isInsideBody(p.x, p.y)) {
          // Reflect velocity and push back inside
          p.vx *= -0.5;
          p.vy *= -0.5;
          // Move back
          p.x -= p.vx * deltaTime * 2;
          p.y -= p.vy * deltaTime * 2;
        }
      }

      // Apply decay
      p.vx *= Math.pow(decay, deltaTime * 60);
      p.vy *= Math.pow(decay, deltaTime * 60);

      // Calculate alpha based on life
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio * lifeRatio; // Quadratic falloff

      // Update instance attributes
      if (visibleCount < this.maxParticles) {
        posAttr.setXYZ(visibleCount, p.x, p.y, p.z);
        sizeAttr.setX(visibleCount, p.size * (0.5 + lifeRatio * 0.5));
        rotAttr.setX(visibleCount, p.rotation);
        alphaAttr.setX(visibleCount, p.alpha);
        colorAttr.setX(visibleCount, p.colorIndex);
        visibleCount++;
      }
    }

    // Zero out remaining instances
    for (let i = visibleCount; i < this.maxParticles; i++) {
      alphaAttr.setX(i, 0);
    }

    // Mark attributes for update
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    rotAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    this.instancedMesh.count = visibleCount;

    // Update time uniform
    if (this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.time.value += deltaTime;
    }

    return visibleCount;
  }

  getActiveCount() {
    return this.activeCount;
  }

  clear() {
    for (const p of this.particlePool) {
      p.active = false;
    }
    this.activeCount = 0;
  }

  dispose() {
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      this.instancedMesh.material.dispose();
      this.scene.remove(this.instancedMesh);
    }
  }
}
