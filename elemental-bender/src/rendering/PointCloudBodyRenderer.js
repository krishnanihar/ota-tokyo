// Point Cloud Body Renderer - Silhouette made of flowing particles
// Element-based drift, trails, and burst effects
import * as THREE from 'three';
import { CONFIG, COLORS, ChargeState, hexToRgb } from '../config.js';

export class PointCloudBodyRenderer {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.points = null;
    this.geometry = null;
    this.material = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.maskTexture = null;

    // Point cloud settings
    this.sampleSpacing = 4;          // Sample every N pixels (denser)
    this.maxPoints = 15000;          // Maximum number of points
    this.pointBaseSize = 6.0;        // Base point size (larger for visibility)
    this.driftSpeed = 30;            // How fast points drift based on element

    // Current state
    this.currentElement = 'fire';
    this.chargeLevel = ChargeState.NONE;
    this.time = 0;

    // 3D landmarks for Z-depth interpolation
    this.worldLandmarks3D = null;
    this.zDepthScale = 50;  // Scale factor for Z displacement
    this.zNoise = 0.3;      // Random Z variation for organic feel

    // Point data arrays (pre-allocated for performance)
    this.positions = null;
    this.colors = null;
    this.sizes = null;
    this.velocities = null;
    this.lifetimes = null;
    this.activeCount = 0;

    // Removed hand attraction - particles flow freely based on element

    // Trail effect settings
    this.trailHistory = [];              // Array of previous position snapshots
    this.trailLength = 5;                // Number of trail frames to keep
    this.trailPoints = null;             // Secondary Points object for trails
    this.trailGeometry = null;
    this.trailMaterial = null;
    this.trailPositions = null;
    this.trailColors = null;
    this.trailSizes = null;

    // Burst effect state
    this.burstParticles = [];            // Active burst particles
    this.maxBurstParticles = 2000;       // Max burst particles
    this.burstGeometry = null;
    this.burstMaterial = null;
    this.burstPoints = null;

    // Dissolve effect state
    this.isDissolving = false;
    this.dissolveStartTime = 0;
    this.dissolveDuration = 1.5;         // Seconds to fully dissolve
  }

  initialize(width, height) {
    this.width = width;
    this.height = height;

    console.log(`PointCloudBodyRenderer: Initializing ${width}x${height}`);

    this.createMaskCanvas(width, height);
    this.createPointCloud();
    this.createTrailSystem();
    this.createBurstSystem();

    console.log('PointCloudBodyRenderer: Initialization complete');
  }

  createMaskCanvas(width, height) {
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    // Also create texture for reference
    this.maskTexture = new THREE.CanvasTexture(this.maskCanvas);
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.magFilter = THREE.LinearFilter;
  }

  createPointCloud() {
    // Pre-allocate arrays for maximum points
    this.positions = new Float32Array(this.maxPoints * 3);
    this.colors = new Float32Array(this.maxPoints * 3);
    this.sizes = new Float32Array(this.maxPoints);
    this.velocities = new Float32Array(this.maxPoints * 2); // xy velocity
    this.lifetimes = new Float32Array(this.maxPoints);

    // Initialize with some default values to ensure geometry is valid
    for (let i = 0; i < this.maxPoints; i++) {
      this.positions[i * 3] = -1000; // Off-screen initially
      this.positions[i * 3 + 1] = -1000;
      this.positions[i * 3 + 2] = 15; // In front - silhouette layer
      this.sizes[i] = this.pointBaseSize;
      this.colors[i * 3] = 1;
      this.colors[i * 3 + 1] = 0;
      this.colors[i * 3 + 2] = 0;
    }

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Use PointsMaterial for reliable point rendering
    this.material = new THREE.PointsMaterial({
      size: this.pointBaseSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false, // Fixed size regardless of distance
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    console.log('PointCloudBodyRenderer: Material created');

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;

    this.scene.add(this.points);
  }

  createTrailSystem() {
    // Create separate geometry for trailing particles (fading echoes)
    const maxTrailPoints = this.maxPoints * this.trailLength;
    this.trailPositions = new Float32Array(maxTrailPoints * 3);
    this.trailColors = new Float32Array(maxTrailPoints * 3);
    this.trailSizes = new Float32Array(maxTrailPoints);

    // Initialize off-screen
    for (let i = 0; i < maxTrailPoints; i++) {
      this.trailPositions[i * 3] = -1000;
      this.trailPositions[i * 3 + 1] = -1000;
      this.trailPositions[i * 3 + 2] = 4; // Behind main points
      this.trailSizes[i] = 2;
      this.trailColors[i * 3] = 0.5;
      this.trailColors[i * 3 + 1] = 0.2;
      this.trailColors[i * 3 + 2] = 0;
    }

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));
    this.trailGeometry.setAttribute('size', new THREE.BufferAttribute(this.trailSizes, 1));

    this.trailMaterial = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.trailPoints = new THREE.Points(this.trailGeometry, this.trailMaterial);
    this.trailPoints.frustumCulled = false;
    this.scene.add(this.trailPoints);

    console.log('PointCloudBodyRenderer: Trail system created');
  }

  createBurstSystem() {
    // Create geometry for burst particles (avatar/collision effects)
    const burstPositions = new Float32Array(this.maxBurstParticles * 3);
    const burstColors = new Float32Array(this.maxBurstParticles * 3);
    const burstSizes = new Float32Array(this.maxBurstParticles);

    // Initialize off-screen
    for (let i = 0; i < this.maxBurstParticles; i++) {
      burstPositions[i * 3] = -1000;
      burstPositions[i * 3 + 1] = -1000;
      burstPositions[i * 3 + 2] = 6;
      burstSizes[i] = 4;
    }

    this.burstGeometry = new THREE.BufferGeometry();
    this.burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    this.burstGeometry.setAttribute('color', new THREE.BufferAttribute(burstColors, 3));
    this.burstGeometry.setAttribute('size', new THREE.BufferAttribute(burstSizes, 1));

    this.burstMaterial = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.burstPoints = new THREE.Points(this.burstGeometry, this.burstMaterial);
    this.burstPoints.frustumCulled = false;
    this.scene.add(this.burstPoints);

    console.log('PointCloudBodyRenderer: Burst system created');
  }

  // Update 3D landmarks for Z-depth interpolation
  updateLandmarks(worldLandmarks3D) {
    this.worldLandmarks3D = worldLandmarks3D;
  }

  // Interpolate Z depth from nearest pose landmarks
  interpolateZ(normalizedX, normalizedY) {
    if (!this.worldLandmarks3D || this.worldLandmarks3D.length === 0) {
      return 0;
    }

    // Find the 3 nearest landmarks and interpolate Z using inverse distance weighting
    let totalWeight = 0;
    let weightedZ = 0;
    const minDist = 0.001; // Minimum distance to avoid division by zero

    // Key body landmarks for interpolation (torso, arms, legs)
    const keyIndices = [
      11, 12,  // Shoulders
      13, 14,  // Elbows
      15, 16,  // Wrists
      23, 24,  // Hips
      25, 26,  // Knees
      27, 28,  // Ankles
      0,       // Nose (for head)
    ];

    for (const idx of keyIndices) {
      if (idx >= this.worldLandmarks3D.length) continue;

      const landmark = this.worldLandmarks3D[idx];
      if (!landmark || landmark.visibility < 0.5) continue;

      // Distance in normalized coordinates
      const dx = normalizedX - landmark.x;
      const dy = normalizedY - landmark.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDist);

      // Inverse distance weighting (closer landmarks have more influence)
      const weight = 1 / (dist * dist);
      totalWeight += weight;
      weightedZ += landmark.z * weight;
    }

    if (totalWeight === 0) return 0;
    return weightedZ / totalWeight;
  }

  updateMask(maskData, width, height) {
    if (!maskData || !this.maskCtx) {
      console.log('PointCloud: No mask data or context');
      return;
    }

    // Draw mask to canvas for sampling
    const imageData = this.maskCtx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < maskData.length; i++) {
      const value = Math.floor(maskData[i] * 255);
      const pixelIndex = i * 4;
      data[pixelIndex] = value;
      data[pixelIndex + 1] = value;
      data[pixelIndex + 2] = value;
      data[pixelIndex + 3] = 255;
    }

    // Scale if needed
    if (width !== this.maskCanvas.width || height !== this.maskCanvas.height) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);

      this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
      this.maskCtx.drawImage(
        tempCanvas,
        0, 0, width, height,
        0, 0, this.maskCanvas.width, this.maskCanvas.height
      );
    } else {
      this.maskCtx.putImageData(imageData, 0, 0);
    }

    // Sample mask to generate points
    this.sampleMaskToPoints();
  }

  sampleMaskToPoints() {
    const imageData = this.maskCtx.getImageData(
      0, 0, this.maskCanvas.width, this.maskCanvas.height
    );
    const data = imageData.data;
    const width = this.maskCanvas.width;
    const height = this.maskCanvas.height;

    // Get element colors
    const colors = COLORS[this.currentElement];
    const primaryRgb = hexToRgb(colors.primary);
    const secondaryRgb = hexToRgb(colors.secondary);
    const glowRgb = hexToRgb(colors.glow);

    // Get element drift direction
    const drift = this.getElementDrift();

    let pointIndex = 0;
    const threshold = CONFIG.MASK_THRESHOLD * 255;

    // Debug: count mask pixels
    let maskPixelCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > threshold) maskPixelCount++;
    }
    if (this.debugCounter === undefined) this.debugCounter = 0;
    if (this.debugCounter++ % 60 === 0) {
      console.log(`Mask: ${width}x${height}, pixels above threshold: ${maskPixelCount}, threshold: ${threshold}`);
    }

    // Sample with jitter for organic distribution
    for (let y = 0; y < height && pointIndex < this.maxPoints; y += this.sampleSpacing) {
      for (let x = 0; x < width && pointIndex < this.maxPoints; x += this.sampleSpacing) {
        // Add random offset for organic distribution
        const jitterX = (Math.random() - 0.5) * this.sampleSpacing * 1.5;
        const jitterY = (Math.random() - 0.5) * this.sampleSpacing * 1.5;

        const sampleX = Math.min(Math.max(Math.floor(x + jitterX), 0), width - 1);
        const sampleY = Math.min(Math.max(Math.floor(y + jitterY), 0), height - 1);

        const pixelIndex = (sampleY * width + sampleX) * 4;
        const maskValue = data[pixelIndex];

        if (maskValue > threshold) {
          // Normalized coordinates for Z interpolation (0-1)
          const normX = sampleX / width;
          const normY = sampleY / height;

          // Interpolate Z depth from pose landmarks
          const interpolatedZ = this.interpolateZ(normX, normY);

          // Position (flip Y for Three.js coordinate system)
          const posIndex = pointIndex * 3;
          this.positions[posIndex] = x + jitterX;
          this.positions[posIndex + 1] = height - (y + jitterY);
          // Apply interpolated Z with scale and slight noise for organic feel
          const zNoise = (Math.random() - 0.5) * this.zNoise;
          this.positions[posIndex + 2] = interpolatedZ * this.zDepthScale + zNoise;

          // Add drift offset based on element
          const driftAmount = this.time * this.driftSpeed;
          const noise = Math.sin(x * 0.05 + this.time) * Math.cos(y * 0.05 + this.time * 0.7);

          this.positions[posIndex] += drift.x * driftAmount * (0.5 + noise * 0.5);
          this.positions[posIndex + 1] += drift.y * driftAmount * (0.5 + noise * 0.5);

          // Color variation based on position and charge
          const colorIndex = pointIndex * 3;
          const colorMix = Math.random();
          const chargeBoost = this.chargeLevel / ChargeState.AVATAR;

          if (colorMix < 0.6) {
            // Primary color
            this.colors[colorIndex] = primaryRgb.r;
            this.colors[colorIndex + 1] = primaryRgb.g;
            this.colors[colorIndex + 2] = primaryRgb.b;
          } else if (colorMix < 0.85) {
            // Secondary color
            this.colors[colorIndex] = secondaryRgb.r;
            this.colors[colorIndex + 1] = secondaryRgb.g;
            this.colors[colorIndex + 2] = secondaryRgb.b;
          } else {
            // Glow color (more frequent at high charge)
            const useGlow = chargeBoost > 0.3 || colorMix > 0.95;
            const rgb = useGlow ? glowRgb : primaryRgb;
            this.colors[colorIndex] = rgb.r;
            this.colors[colorIndex + 1] = rgb.g;
            this.colors[colorIndex + 2] = rgb.b;
          }

          // Size variation
          const sizeNoise = 0.5 + Math.random() * 1.0;
          const edgeFactor = maskValue / 255; // Smaller at edges
          this.sizes[pointIndex] = this.pointBaseSize * sizeNoise * (0.5 + edgeFactor * 0.5);

          // Store velocity for animation
          const velIndex = pointIndex * 2;
          this.velocities[velIndex] = drift.x + (Math.random() - 0.5) * 0.5;
          this.velocities[velIndex + 1] = drift.y + (Math.random() - 0.5) * 0.5;

          pointIndex++;
        }
      }
    }

    this.activeCount = pointIndex;

    // Update geometry
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Set draw range to only render active points
    this.geometry.setDrawRange(0, this.activeCount);

    // Debug log
    if (this.debugCounter % 60 === 0) {
      console.log(`PointCloud: ${this.activeCount} points created`);
    }
  }

  getElementDrift() {
    // Each element has characteristic point movement
    const driftPatterns = {
      fire: { x: 0, y: 0.5 },      // Drift upward
      water: { x: 0, y: -0.3 },    // Drift downward
      earth: { x: 0, y: 0 },       // Stable, no drift
      air: { x: 0.3, y: 0.2 }      // Diagonal swirl
    };

    const base = driftPatterns[this.currentElement] || driftPatterns.fire;

    // Add swirl for air element
    if (this.currentElement === 'air') {
      const swirl = this.time * 2;
      return {
        x: Math.sin(swirl) * 0.4,
        y: Math.cos(swirl) * 0.3
      };
    }

    return base;
  }

  setElement(elementType) {
    this.currentElement = elementType;
    const colors = COLORS[elementType];

    // Clear all persistent effects when changing elements
    this.clearAllEffects();

    if (this.material?.uniforms) {
      this.material.uniforms.elementColor.value.set(colors.primary);
      this.material.uniforms.glowColor.value.set(colors.glow);
    }

    // Adjust point density per element
    const densityMap = {
      fire: 5,     // Dense sparks
      water: 6,    // Medium density droplets
      earth: 8,    // Sparse, chunky
      air: 4       // Very dense, misty
    };
    this.sampleSpacing = densityMap[elementType] || 6;
  }

  // Clear all burst particles and trails
  clearAllEffects() {
    // Clear burst particles
    this.burstParticles = [];
    if (this.burstGeometry) {
      this.burstGeometry.setDrawRange(0, 0);
    }

    // Clear trails
    this.trailHistory = [];
    if (this.trailGeometry) {
      this.trailGeometry.setDrawRange(0, 0);
    }

    // Reset dissolve state
    this.isDissolving = false;
  }

  setChargeLevel(level) {
    this.chargeLevel = level;
    const normalizedCharge = level / ChargeState.AVATAR;

    // Increase point size with charge
    if (this.material) {
      this.material.size = this.pointBaseSize * (1 + normalizedCharge * 0.5);
    }

    // Increase density at higher charge
    const baseDensity = {
      fire: 4,
      water: 5,
      earth: 6,
      air: 3
    }[this.currentElement] || 4;

    // More points at higher charge
    this.sampleSpacing = Math.max(2, baseDensity - Math.floor(normalizedCharge * 2));
  }

  update(time, deltaTime, handPositions = null, chargeLevel = 0) {
    this.time = time;

    // Update charge level
    if (chargeLevel !== undefined) {
      this.chargeLevel = chargeLevel;
    }

    // Handle dissolve effect
    if (this.isDissolving) {
      this.updateDissolve(time, deltaTime);
      return; // Skip normal update during dissolve
    }

    // Animate existing points with element-based drift (no hand attraction)
    if (this.activeCount > 0 && deltaTime) {
      const drift = this.getElementDrift();
      const normalizedCharge = this.chargeLevel / ChargeState.AVATAR;

      for (let i = 0; i < this.activeCount; i++) {
        const posIndex = i * 3;
        const velIndex = i * 2;

        // Get current velocity
        let vx = this.velocities[velIndex];
        let vy = this.velocities[velIndex + 1];

        // Gentle damping for smooth motion
        vx *= 0.95;
        vy *= 0.95;

        // Element drift - the main movement based on element type
        vx += drift.x * this.driftSpeed * deltaTime;
        vy += drift.y * this.driftSpeed * deltaTime;

        // Store updated velocity
        this.velocities[velIndex] = vx;
        this.velocities[velIndex + 1] = vy;

        // Apply movement
        this.positions[posIndex] += vx * deltaTime;
        this.positions[posIndex + 1] += vy * deltaTime;

        // Subtle organic wave motion
        const wavePhase = time * 1.5 + i * 0.02;
        const waveStrength = 0.3 + normalizedCharge * 0.5;
        this.positions[posIndex] += Math.sin(wavePhase) * waveStrength * deltaTime * 30;
        this.positions[posIndex + 1] += Math.cos(wavePhase * 0.7) * waveStrength * deltaTime * 20;
      }

      this.geometry.attributes.position.needsUpdate = true;
    }

    // Update trails
    this.updateTrails(deltaTime);

    // Update burst particles
    this.updateBurstParticles(deltaTime);
  }

  // Update trail particles (fading motion echoes)
  updateTrails(deltaTime) {
    if (!this.trailGeometry || this.activeCount === 0) return;

    // Store current positions in history
    const currentSnapshot = new Float32Array(this.activeCount * 3);
    for (let i = 0; i < this.activeCount * 3; i++) {
      currentSnapshot[i] = this.positions[i];
    }

    this.trailHistory.unshift({
      positions: currentSnapshot,
      count: this.activeCount
    });

    // Trim history
    while (this.trailHistory.length > this.trailLength) {
      this.trailHistory.pop();
    }

    // Update trail geometry from history
    const colors = COLORS[this.currentElement];
    const primaryRgb = hexToRgb(colors.primary);
    const glowRgb = hexToRgb(colors.glow);

    let trailIndex = 0;
    const maxTrailPoints = this.maxPoints * this.trailLength;

    for (let h = 0; h < this.trailHistory.length; h++) {
      const snapshot = this.trailHistory[h];
      const fadeAmount = (h + 1) / (this.trailHistory.length + 1); // 0.2 to 1.0

      // Sample subset of points for trails (every 3rd point for performance)
      for (let i = 0; i < snapshot.count && trailIndex < maxTrailPoints; i += 3) {
        const srcIndex = i * 3;
        const dstIndex = trailIndex * 3;

        // Position with slight offset backward
        this.trailPositions[dstIndex] = snapshot.positions[srcIndex] - h * 2;
        this.trailPositions[dstIndex + 1] = snapshot.positions[srcIndex + 1] - h * 2;
        this.trailPositions[dstIndex + 2] = 4 - h * 0.5; // Stack behind

        // Color fades toward glow
        const colorBlend = fadeAmount * 0.5;
        this.trailColors[dstIndex] = primaryRgb.r * (1 - colorBlend) + glowRgb.r * colorBlend;
        this.trailColors[dstIndex + 1] = primaryRgb.g * (1 - colorBlend) + glowRgb.g * colorBlend;
        this.trailColors[dstIndex + 2] = primaryRgb.b * (1 - colorBlend) + glowRgb.b * colorBlend;

        // Size decreases with age
        this.trailSizes[trailIndex] = this.pointBaseSize * (1 - fadeAmount * 0.7) * 0.6;

        trailIndex++;
      }
    }

    // Hide unused trail points
    for (let i = trailIndex; i < maxTrailPoints; i++) {
      this.trailPositions[i * 3] = -1000;
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
    this.trailGeometry.attributes.size.needsUpdate = true;
    this.trailGeometry.setDrawRange(0, trailIndex);

    // Increase trail opacity based on charge
    const normalizedCharge = this.chargeLevel / ChargeState.AVATAR;
    this.trailMaterial.opacity = 0.3 + normalizedCharge * 0.4;
  }

  // Update active burst particles
  updateBurstParticles(deltaTime) {
    if (this.burstParticles.length === 0) return;

    const burstPositions = this.burstGeometry.attributes.position.array;
    const burstColors = this.burstGeometry.attributes.color.array;
    const burstSizes = this.burstGeometry.attributes.size.array;

    let aliveCount = 0;

    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.burstParticles.splice(i, 1);
        continue;
      }

      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;

      // Apply gravity/element behavior
      if (this.currentElement === 'fire') {
        p.vy += 50 * deltaTime; // Float up
      } else if (this.currentElement === 'water') {
        p.vy -= 80 * deltaTime; // Fall down
      } else if (this.currentElement === 'air') {
        p.vx += Math.sin(this.time * 5 + i) * 30 * deltaTime;
        p.vy += Math.cos(this.time * 4 + i) * 20 * deltaTime;
      }

      // Drag
      p.vx *= 0.98;
      p.vy *= 0.98;

      const idx = aliveCount * 3;
      burstPositions[idx] = p.x;
      burstPositions[idx + 1] = p.y;
      burstPositions[idx + 2] = 6;

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      burstColors[idx] = p.color.r * lifeRatio;
      burstColors[idx + 1] = p.color.g * lifeRatio;
      burstColors[idx + 2] = p.color.b * lifeRatio;

      burstSizes[aliveCount] = p.size * lifeRatio;

      aliveCount++;
    }

    // Hide remaining slots
    for (let i = aliveCount; i < this.maxBurstParticles; i++) {
      burstPositions[i * 3] = -1000;
    }

    this.burstGeometry.attributes.position.needsUpdate = true;
    this.burstGeometry.attributes.color.needsUpdate = true;
    this.burstGeometry.attributes.size.needsUpdate = true;
    this.burstGeometry.setDrawRange(0, aliveCount);
  }

  // Trigger avatar state burst - particles explode outward dramatically
  triggerAvatarBurst() {
    console.log('PointCloudBodyRenderer: Triggering AVATAR burst!');

    const colors = COLORS[this.currentElement];
    const primaryRgb = hexToRgb(colors.primary);
    const glowRgb = hexToRgb(colors.glow);

    // Spawn burst particles from current body points
    const burstCount = Math.min(500, this.activeCount);

    for (let i = 0; i < burstCount; i++) {
      const srcIdx = Math.floor(Math.random() * this.activeCount);
      const posIdx = srcIdx * 3;

      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 300;

      this.burstParticles.push({
        x: this.positions[posIdx],
        y: this.positions[posIdx + 1],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 8 + Math.random() * 15,
        life: 1.0 + Math.random() * 1.0,
        maxLife: 2.0,
        color: Math.random() > 0.5 ? primaryRgb : glowRgb
      });
    }
  }

  // Trigger collision burst - when hands collide
  triggerCollisionBurst(x, y, chargeLevel) {
    console.log('PointCloudBodyRenderer: Triggering collision burst!');

    const colors = COLORS[this.currentElement];
    const primaryRgb = hexToRgb(colors.primary);
    const secondaryRgb = hexToRgb(colors.secondary);
    const glowRgb = hexToRgb(colors.glow);

    const burstCount = 200 + chargeLevel * 100;

    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 400;

      const colorChoice = Math.random();
      let color;
      if (colorChoice < 0.4) color = primaryRgb;
      else if (colorChoice < 0.7) color = secondaryRgb;
      else color = glowRgb;

      this.burstParticles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 12,
        life: 0.8 + Math.random() * 0.8,
        maxLife: 1.6,
        color: color
      });
    }
  }

  // Start dissolve effect (charge release)
  startDissolve() {
    console.log('PointCloudBodyRenderer: Starting dissolve effect');
    this.isDissolving = true;
    this.dissolveStartTime = this.time;

    // Give all points outward velocity
    for (let i = 0; i < this.activeCount; i++) {
      const posIdx = i * 3;
      const velIdx = i * 2;

      // Calculate direction from center
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dx = this.positions[posIdx] - cx;
      const dy = this.positions[posIdx + 1] - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Outward burst velocity
      const burstSpeed = 200 + Math.random() * 300;
      this.velocities[velIdx] = (dx / dist) * burstSpeed;
      this.velocities[velIdx + 1] = (dy / dist) * burstSpeed;
    }
  }

  // Update dissolve animation
  updateDissolve(time, deltaTime) {
    const elapsed = time - this.dissolveStartTime;
    const progress = Math.min(elapsed / this.dissolveDuration, 1.0);

    if (progress >= 1.0) {
      this.isDissolving = false;
      return;
    }

    // Animate particles outward with fading
    for (let i = 0; i < this.activeCount; i++) {
      const posIdx = i * 3;
      const velIdx = i * 2;
      const colorIdx = i * 3;

      // Apply velocity with deceleration
      const decay = 1 - progress * 0.5;
      this.positions[posIdx] += this.velocities[velIdx] * deltaTime * decay;
      this.positions[posIdx + 1] += this.velocities[velIdx + 1] * deltaTime * decay;

      // Element-specific behavior during dissolve
      if (this.currentElement === 'fire') {
        this.positions[posIdx + 1] += 100 * deltaTime; // Float up
      } else if (this.currentElement === 'water') {
        this.positions[posIdx + 1] -= 80 * deltaTime; // Fall
      }

      // Fade out colors
      const fade = 1 - progress;
      this.colors[colorIdx] *= (1 - deltaTime * 2);
      this.colors[colorIdx + 1] *= (1 - deltaTime * 2);
      this.colors[colorIdx + 2] *= (1 - deltaTime * 2);

      // Shrink sizes
      this.sizes[i] *= (1 - deltaTime * 1.5);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Also fade trails
    if (this.trailMaterial) {
      this.trailMaterial.opacity = 0.4 * (1 - progress);
    }
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;

    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
    }

    if (this.geometry) {
      this.geometry.dispose();
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.maskTexture) {
      this.maskTexture.dispose();
    }

    // Dispose trail system
    if (this.trailPoints) {
      this.scene.remove(this.trailPoints);
    }
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
    }
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }

    // Dispose burst system
    if (this.burstPoints) {
      this.scene.remove(this.burstPoints);
    }
    if (this.burstGeometry) {
      this.burstGeometry.dispose();
    }
    if (this.burstMaterial) {
      this.burstMaterial.dispose();
    }
  }
}
