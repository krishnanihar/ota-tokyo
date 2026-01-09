// Point Cloud Body Renderer - Silhouette made of flowing particles
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

    // Point data arrays (pre-allocated for performance)
    this.positions = null;
    this.colors = null;
    this.sizes = null;
    this.velocities = null;
    this.lifetimes = null;
    this.activeCount = 0;
  }

  initialize(width, height) {
    this.width = width;
    this.height = height;

    console.log(`PointCloudBodyRenderer: Initializing ${width}x${height}`);

    this.createMaskCanvas(width, height);
    this.createPointCloud();

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
      this.positions[i * 3 + 2] = 5; // In front of other elements
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
          // Position (flip Y for Three.js coordinate system)
          const posIndex = pointIndex * 3;
          this.positions[posIndex] = x + jitterX;
          this.positions[posIndex + 1] = height - (y + jitterY);
          this.positions[posIndex + 2] = 0;

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

  update(time, deltaTime) {
    this.time = time;

    // Animate existing points (subtle movement between mask updates)
    if (this.activeCount > 0 && deltaTime) {
      const drift = this.getElementDrift();
      const driftScale = deltaTime * this.driftSpeed * 0.5;

      for (let i = 0; i < this.activeCount; i++) {
        const posIndex = i * 3;
        const velIndex = i * 2;

        // Apply velocity with element drift
        this.positions[posIndex] += this.velocities[velIndex] * driftScale;
        this.positions[posIndex + 1] += this.velocities[velIndex + 1] * driftScale;
      }

      this.geometry.attributes.position.needsUpdate = true;
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
  }
}
