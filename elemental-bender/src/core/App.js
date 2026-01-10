// Main Application Orchestrator
import { CONFIG, COLORS, ElementType, ChargeState } from '../config.js';
import { MediaPipeSetup } from '../detection/MediaPipeSetup.js';
import { PoseProcessor } from '../detection/PoseProcessor.js';
import { SegmentationMask } from '../detection/SegmentationMask.js';
import { SceneSetup } from '../rendering/SceneSetup.js';
import { BodyRenderer } from '../rendering/BodyRenderer.js';
import { PointCloudBodyRenderer } from '../rendering/PointCloudBodyRenderer.js';
import { HandRenderer } from '../rendering/HandRenderer.js';
import { HandOrbRenderer } from '../rendering/HandOrbRenderer.js';
import { ChargeSystem } from '../systems/ChargeSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { GPUParticleSystem } from '../systems/GPUParticleSystem.js';
import { CycleSystem } from '../systems/CycleSystem.js';
import { InputManager } from './InputManager.js';
import { FireElement } from '../elements/FireElement.js';
import { WaterElement } from '../elements/WaterElement.js';
import { EarthElement } from '../elements/EarthElement.js';
import { AirElement } from '../elements/AirElement.js';
import { ProceduralBrushes } from '../assets/ProceduralBrushes.js';
import { BackgroundEffects } from '../rendering/BackgroundEffects.js';

export class App {
  constructor() {
    // Core systems
    this.mediaPipe = new MediaPipeSetup();
    this.poseProcessor = new PoseProcessor();
    this.segmentationMask = new SegmentationMask();
    this.scene = new SceneSetup();
    this.bodyRenderer = null;
    this.pointCloudBody = null;  // Point cloud silhouette
    this.handRenderer = null;
    this.handOrbRenderer = null;  // Dramatic element-specific hand orbs
    this.particleSystem = null;
    this.chargeSystem = new ChargeSystem();
    this.cycleSystem = new CycleSystem();
    this.inputManager = new InputManager();
    this.brushes = new ProceduralBrushes();
    this.backgroundEffects = null;  // Ambient atmospheric particles

    // Elements
    this.elements = {};
    this.activeElement = null;

    // State
    this.isRunning = false;
    this.currentElement = ElementType.FIRE;
    this.currentMode = 'sandbox';
    this.mirrorMode = CONFIG.MIRROR_MODE;
    this.lastPoseData = null;

    // Performance tracking
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = 0;
    this.lastParticleCount = 0;

    // DOM elements
    this.video = null;
    this.canvas = null;
    this.loadingEl = null;
    this.debugEl = null;
    this.statusIcon = null;
    this.statusText = null;

    // Detection status
    this.isDetecting = false;
    this.framesWithoutDetection = 0;

    // AVATAR state tracking for continuous effects
    this.isInAvatarState = false;

    // Hand collision state
    this.handsAreTouching = false;
    this.handCollisionCooldown = 0;

    // Multi-person effect assignment
    this.detectedPeopleCount = 0;
    this.effectAssignmentMode = 'both'; // 'pointCloud', 'silhouette', 'both', 'alternate'
    this.effectSwitchTimer = 0;
    this.effectSwitchInterval = 2.0; // Switch every 2 seconds when >2 people
  }

  async initialize() {
    try {
      // Get DOM elements
      this.video = document.getElementById('video');
      this.canvas = document.getElementById('canvas');
      this.loadingEl = document.getElementById('loading');
      this.debugEl = document.getElementById('debug');
      this.statusIcon = document.getElementById('status-icon');
      this.statusText = document.getElementById('status-text');

      this.updateLoadingText('Initializing renderer...');

      // Initialize Three.js scene
      await this.scene.initialize(this.canvas);

      this.updateLoadingText('Starting camera...');

      // Initialize MediaPipe
      await this.mediaPipe.initialize(this.video);

      // Get video dimensions for mask processing
      const videoSize = this.mediaPipe.getVideoSize();
      this.segmentationMask.initialize(videoSize.width, videoSize.height);

      this.updateLoadingText('Setting up renderers...');

      // Initialize procedural brushes
      this.brushes.initialize();

      // Point cloud body renderer - RE-ENABLED for organic flowing particles
      // Particles flow from body silhouette toward hand orbs
      this.pointCloudBody = new PointCloudBodyRenderer(this.scene);
      this.pointCloudBody.initialize(this.scene.getWidth(), this.scene.getHeight());
      this.pointCloudBody.setElement(this.currentElement);
      // Point cloud is now VISIBLE - provides flowing particle body effect

      // Solid body silhouette renderer - PRIMARY body visualization
      this.bodyRenderer = new BodyRenderer(this.scene);
      this.bodyRenderer.initialize(this.scene.getWidth(), this.scene.getHeight());
      this.bodyRenderer.setElement(this.currentElement);
      // Body silhouette is now visible - provides solid foundation for energy

      // Initialize hand renderer
      this.handRenderer = new HandRenderer(this.scene);
      this.handRenderer.initialize();
      this.handRenderer.setElement(this.currentElement);

      // Initialize dramatic hand orb renderer
      this.handOrbRenderer = new HandOrbRenderer(this.scene);
      this.handOrbRenderer.initialize();
      this.handOrbRenderer.setElement(this.currentElement);

      // Initialize particle system - try GPU version first, fall back to legacy
      if (this.scene.hasWebGPU()) {
        try {
          console.log('Attempting GPUParticleSystem with WebGPU compute shaders');
          this.particleSystem = new GPUParticleSystem(this.scene);
          await this.particleSystem.initialize();
          console.log('GPUParticleSystem initialized successfully');
        } catch (gpuError) {
          console.warn('GPUParticleSystem failed, falling back to legacy:', gpuError);
          this.particleSystem = new ParticleSystem(this.scene);
          this.particleSystem.initialize();
        }
      } else {
        console.log('Using legacy ParticleSystem (WebGL)');
        this.particleSystem = new ParticleSystem(this.scene);
        this.particleSystem.initialize();
      }
      this.particleSystem.setElement(this.currentElement);

      // Initialize ambient background effects (drifting particles behind everything)
      this.backgroundEffects = new BackgroundEffects(this.scene);
      this.backgroundEffects.initialize(this.scene.getWidth(), this.scene.getHeight());
      this.backgroundEffects.setElement(this.currentElement);

      // Set body mask reference for particle containment
      if (this.particleSystem.setBodyMask) {
        this.particleSystem.setBodyMask(this.segmentationMask);
      }

      // Initialize all elements
      this.elements.fire = new FireElement(this.particleSystem, this.segmentationMask);
      this.elements.water = new WaterElement(this.particleSystem, this.segmentationMask);
      this.elements.earth = new EarthElement(this.particleSystem, this.segmentationMask);
      this.elements.air = new AirElement(this.particleSystem, this.segmentationMask);

      // Set active element
      this.activeElement = this.elements.fire;
      this.activeElement.activate();

      // Setup event handlers
      this.setupEventHandlers();

      // Hide loading, show app
      this.loadingEl.style.display = 'none';

      // Update status to searching
      this.updateStatus('searching', 'Looking for you...');

      // Start render loop
      this.isRunning = true;
      this.animate();

      console.log('Elemental Bender initialized successfully');
      return true;
    } catch (error) {
      console.error('Initialization failed:', error);
      console.error('Stack:', error.stack);
      this.updateLoadingText(`Error: ${error.message}`);
      // Re-throw to allow main.js to show more details
      throw error;
    }
  }

  setupEventHandlers() {
    // Input manager events
    this.inputManager.on('toggleDebug', (visible) => {
      this.debugEl.classList.toggle('visible', visible);
    });

    this.inputManager.on('toggleMirror', (mirrored) => {
      this.mirrorMode = mirrored;
    });

    this.inputManager.on('modeChange', (mode) => {
      this.setMode(mode);
    });

    // Manual element switching (keys 3-6)
    this.inputManager.on('elementChange', (element) => {
      this.setElement(element);
    });

    // Skip to next element (space)
    this.inputManager.on('skipElement', () => {
      this.cycleSystem.skipToNext();
    });

    // Charge system events
    this.chargeSystem.onLevelChange = (newLevel, oldLevel) => {
      this.onChargeLevelChange(newLevel, oldLevel);
    };

    this.chargeSystem.onRelease = (releaseData) => {
      this.onEnergyRelease(releaseData);
    };

    // Cycle system events
    this.cycleSystem.onElementChange = (newElement, oldElement) => {
      console.log(`CycleSystem callback: changing element ${oldElement} -> ${newElement}`);
      this.setElement(newElement);
    };
    console.log('CycleSystem callbacks registered');

    this.cycleSystem.onTransitionStart = (fromElement, toElement) => {
      console.log(`Transition starting: ${fromElement} -> ${toElement}`);
    };

    // Window resize
    window.addEventListener('resize', () => this.onResize());
  }

  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(() => this.animate());

    const timestamp = performance.now();
    const deltaTime = this.scene.getDeltaTime();

    // Update FPS counter
    this.updateFps(timestamp);

    // Update element cycle (only in sandbox mode)
    if (this.currentMode === 'sandbox') {
      this.cycleSystem.update(deltaTime);
    }

    // Detect pose
    const detection = this.mediaPipe.detect(timestamp);

    let poseData = null;

    if (detection) {
      // Process pose data (include worldLandmarks for 3D depth interpolation)
      const hasLandmarks = detection.landmarks?.length > 0;
      poseData = hasLandmarks
        ? this.poseProcessor.process(detection.landmarks, timestamp, detection.worldLandmarks)
        : null;

      // Update detection status and people count
      if (hasLandmarks) {
        if (!this.isDetecting) {
          this.isDetecting = true;
          this.updateStatus('detecting', 'Tracking active');
        }
        this.framesWithoutDetection = 0;

        // Track number of detected people for effect assignment
        const newPeopleCount = detection.landmarks.length;
        if (newPeopleCount !== this.detectedPeopleCount) {
          this.detectedPeopleCount = newPeopleCount;
          this.updateEffectAssignment();
          console.log(`People detected: ${newPeopleCount}, Effect mode: ${this.effectAssignmentMode}`);
        }
      } else {
        this.framesWithoutDetection++;
        if (this.framesWithoutDetection > 30 && this.isDetecting) {
          this.isDetecting = false;
          this.updateStatus('searching', 'Looking for you...');
          this.detectedPeopleCount = 0;
        }
      }

      // Update segmentation mask
      // Note: MediaPipe returns ONE combined mask for all detected people
      if (detection.segmentationMasks?.length > 0) {
        const maskData = this.segmentationMask.update(detection.segmentationMasks[0]);

        if (maskData) {
          // Get actual mask dimensions from the segmentation mask processor
          const maskWidth = this.segmentationMask.getMaskWidth();
          const maskHeight = this.segmentationMask.getMaskHeight();

          // Update body renderer with mask (handle mirror mode)
          const processedMask = this.mirrorMode
            ? this.mirrorMaskData(maskData, maskWidth, maskHeight)
            : maskData;

          // Update segmentationMask with mirrored data so particles spawn correctly
          if (this.mirrorMode) {
            this.segmentationMask.setMirroredData(processedMask);
          }

          this.bodyRenderer.updateMask(
            processedMask,
            maskWidth,
            maskHeight
          );

          // Update point cloud body with same mask
          // Also pass 3D landmarks for Z-depth interpolation
          if (poseData?.worldLandmarks3D) {
            this.pointCloudBody.updateLandmarks(poseData.worldLandmarks3D);
          }
          this.pointCloudBody.updateMask(
            processedMask,
            maskWidth,
            maskHeight
          );

          // Update particle body-relative scaling based on detected body size
          if (this.particleSystem.updateBodyScale) {
            this.particleSystem.updateBodyScale(this.segmentationMask);
          }
        }
      }

      // Update charge system
      const chargeData = this.chargeSystem.update(poseData, deltaTime);

      if (chargeData) {
        this.bodyRenderer.setChargeLevel(chargeData.level);
        this.pointCloudBody.setChargeLevel(chargeData.level);
        this.handRenderer.setChargeLevel(chargeData.level);
        this.activeElement?.setChargeLevel(chargeData.level);

        // Update particle charge-based scaling
        if (this.particleSystem.updateChargeScale) {
          this.particleSystem.updateChargeScale(chargeData.level);
        }

        // Update particle system with hand positions and spawn body/hand particles
        if (this.particleSystem.updateHandPositions && poseData?.hands) {
          this.particleSystem.updateHandPositions(poseData.hands, this.mirrorMode);
        }

        // Spawn particles filling the body silhouette
        if (this.particleSystem.spawnBodyFill && this.isDetecting) {
          const fillCount = 3 + chargeData.level * 2; // More particles at higher charge
          this.particleSystem.spawnBodyFill(this.segmentationMask, fillCount, chargeData.level);
        }

        // Spawn concentrated orb particles at hands
        if (this.particleSystem.spawnHandOrbs && chargeData.level > 0) {
          this.particleSystem.spawnHandOrbs(chargeData.level);
        }
      }

      // Handle movement states
      if (poseData && chargeData) {
        if (poseData.isSlowMove && chargeData.level > ChargeState.NONE) {
          this.activeElement?.onSlowMove(poseData);
        }
      }

      this.lastPoseData = poseData;

      // Update debug display
      if (this.inputManager.getDebugVisible()) {
        this.updateDebug(poseData, chargeData);
      }
    }

    // Update renderers
    const time = this.scene.getElapsedTime();
    const currentChargeLevel = this.chargeSystem.getLevel();

    // Update ambient background effects (drifting particles)
    this.backgroundEffects?.update(time, deltaTime);

    this.bodyRenderer.update(time);

    // Calculate hand screen positions for attraction
    const handPositions = this.calculateHandPositions(this.lastPoseData?.hands);

    // Update point cloud with hand attraction targets
    this.pointCloudBody.update(time, deltaTime, handPositions, currentChargeLevel);

    // Hide old HandRenderer when charging - HandOrbRenderer is the main effect
    // Only show subtle glow when NOT charging
    if (currentChargeLevel > 0) {
      this.handRenderer.leftHandMesh.visible = false;
      this.handRenderer.rightHandMesh.visible = false;
      this.handRenderer.glowMeshes.forEach(m => m.visible = false);
    } else {
      this.handRenderer.update(time, this.lastPoseData?.hands, this.mirrorMode);
    }

    // Update dramatic hand orb renderer
    this.handOrbRenderer.update(time, this.lastPoseData?.hands, currentChargeLevel, this.mirrorMode);

    // Check for hand collision and trigger mixing effects
    this.checkHandCollision(handPositions, currentChargeLevel, time);

    // Continuous AVATAR state effects (animate chromatic aberration)
    if (this.isInAvatarState) {
      this.scene.updateAvatarEffects(time);
    }

    // Update active element (spawns particles, etc.)
    this.activeElement?.update(deltaTime, this.lastPoseData);

    // Update particle system
    // GPUParticleSystem.update is async but we don't need to await it
    // The GPU compute will run in parallel and sync automatically on render
    const updateResult = this.particleSystem.update(deltaTime, this.lastPoseData?.bodyCenter);

    // Handle both sync (legacy) and async (GPU) particle counts
    if (updateResult && typeof updateResult.then === 'function') {
      // Async GPU particle system - use cached count
      updateResult.then(() => {
        this.lastParticleCount = this.particleSystem.getActiveCount();
      }).catch(err => console.warn('Particle update error:', err));
    } else {
      // Sync legacy particle system
      this.lastParticleCount = updateResult || 0;
    }

    // Update particle count in debug
    if (this.inputManager.getDebugVisible()) {
      document.getElementById('particle-count').textContent = this.lastParticleCount || 0;
    }

    // Render scene
    this.scene.render();
  }

  mirrorMaskData(maskData, width, height) {
    const mirrored = new Float32Array(maskData.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = y * width + (width - 1 - x);
        mirrored[dstIndex] = maskData[srcIndex];
      }
    }

    return mirrored;
  }

  updateFps(timestamp) {
    this.frameCount++;

    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }
  }

  updateDebug(poseData, chargeData) {
    document.getElementById('fps').textContent = this.fps;
    document.getElementById('velocity').textContent = poseData?.velocity?.toFixed(4) || '0';
    document.getElementById('charge-level').textContent = chargeData?.level || 0;
    document.getElementById('current-element').textContent = this.currentElement;
  }

  updateLoadingText(text) {
    const loadingTextEl = this.loadingEl?.querySelector('div:last-child');
    if (loadingTextEl) {
      loadingTextEl.textContent = text;
    }
  }

  updateStatus(state, text) {
    if (this.statusIcon) {
      this.statusIcon.className = state;
    }
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  onChargeLevelChange(newLevel, oldLevel) {
    console.log(`Charge level: ${oldLevel} -> ${newLevel}`);

    // Update UI charge indicator
    const dots = document.querySelectorAll('#charge-indicator .dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index < newLevel);
    });

    // Avatar state special effects
    if (newLevel === ChargeState.AVATAR) {
      console.log('AVATAR STATE ACHIEVED!');
      this.isInAvatarState = true;
      // Trigger screen effects: chromatic aberration, screen shake, boosted bloom
      this.scene.setAvatarEffects(true, 1.0);
      // Trigger dramatic burst from hand orbs
      this.handOrbRenderer.triggerAvatarBurst();
      // Trigger point cloud burst toward hands
      this.pointCloudBody.triggerAvatarBurst?.();
    } else if (oldLevel === ChargeState.AVATAR && newLevel < ChargeState.AVATAR) {
      // Leaving AVATAR state - disable screen effects
      this.isInAvatarState = false;
      this.scene.setAvatarEffects(false);
    }
  }

  onEnergyRelease(releaseData) {
    console.log('Energy released:', releaseData);

    // Trigger element's fast move effect
    if (this.lastPoseData && releaseData.isFastMove) {
      this.activeElement?.onFastMove(this.lastPoseData, releaseData);
    }

    // Trigger dissolve effect on point cloud if charge was significant
    if (releaseData.level >= ChargeState.FORM) {
      this.pointCloudBody.startDissolve?.();
    }

    // Turn off AVATAR effects when releasing energy
    if (this.isInAvatarState) {
      this.isInAvatarState = false;
      this.scene.setAvatarEffects(false);
    }
  }

  setElement(elementType) {
    // Deactivate current element
    this.activeElement?.deactivate();

    // Clear existing particles for smooth transition
    this.particleSystem.clear();

    this.currentElement = elementType;
    this.bodyRenderer.setElement(elementType);
    this.pointCloudBody.setElement(elementType);
    this.handRenderer.setElement(elementType);
    this.handOrbRenderer.setElement(elementType);
    this.particleSystem.setElement(elementType);
    this.backgroundEffects?.setElement(elementType);

    // Activate new element
    if (this.elements[elementType]) {
      this.activeElement = this.elements[elementType];
      this.activeElement.activate();
    }

    // Update UI
    const elementIndicator = document.getElementById('element-indicator');
    elementIndicator.textContent = elementType.toUpperCase();
    elementIndicator.style.color = COLORS[elementType].primary;
    elementIndicator.classList.add('visible');

    // Hide after 2 seconds
    setTimeout(() => {
      elementIndicator.classList.remove('visible');
    }, 2000);
  }

  setMode(mode) {
    this.currentMode = mode;
    console.log(`Mode changed to: ${mode}`);

    // Update UI based on mode
    if (mode === 'sandbox') {
      document.getElementById('training-text').classList.remove('visible');
      this.cycleSystem.setEnabled(true);
    } else if (mode === 'training') {
      this.cycleSystem.setEnabled(false);
      // TODO: Initialize training mode lessons
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.bodyRenderer?.onResize(width, height);
    this.pointCloudBody?.onResize(width, height);
    this.backgroundEffects?.onResize(width, height);

    // Update particle screen-relative scaling
    if (this.particleSystem?.updateScreenScale) {
      this.particleSystem.updateScreenScale();
    }
  }

  // Update effect assignment - same effect for all players
  // Shows both point cloud and silhouette for everyone
  updateEffectAssignment() {
    const count = this.detectedPeopleCount;

    // Same effect for all players - show both silhouette and point cloud
    this.effectAssignmentMode = 'both';
    if (this.bodyRenderer?.bodyMesh) this.bodyRenderer.bodyMesh.visible = true;
    if (this.bodyRenderer?.glowMesh) this.bodyRenderer.glowMesh.visible = true;
    if (this.pointCloudBody?.points) this.pointCloudBody.points.visible = true;

    // Update status text
    this.updateStatus('detecting', `${count} ${count === 1 ? 'person' : 'people'}`);
  }

  // Calculate screen positions for both hands
  calculateHandPositions(hands) {
    const positions = { left: null, right: null };

    if (hands?.left?.palm && hands.left.palm.visibility > 0.3) {
      let x = hands.left.palm.x * this.scene.getWidth();
      const y = (1 - hands.left.palm.y) * this.scene.getHeight();
      if (this.mirrorMode) x = this.scene.getWidth() - x;
      positions.left = { x, y };
    }

    if (hands?.right?.palm && hands.right.palm.visibility > 0.3) {
      let x = hands.right.palm.x * this.scene.getWidth();
      const y = (1 - hands.right.palm.y) * this.scene.getHeight();
      if (this.mirrorMode) x = this.scene.getWidth() - x;
      positions.right = { x, y };
    }

    return positions;
  }

  // Check if hands are close enough to trigger mixing effects
  checkHandCollision(handPositions, chargeLevel, time) {
    // Reduce cooldown
    if (this.handCollisionCooldown > 0) {
      this.handCollisionCooldown -= 0.016; // ~60fps
    }

    if (!handPositions.left || !handPositions.right) {
      this.handsAreTouching = false;
      return;
    }

    // Calculate distance between hands
    const dx = handPositions.left.x - handPositions.right.x;
    const dy = handPositions.left.y - handPositions.right.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Collision threshold scales with charge level (larger orbs = larger threshold)
    const baseThreshold = 80;
    const chargeBonus = chargeLevel * 30;
    const collisionThreshold = baseThreshold + chargeBonus;

    const wasTouch = this.handsAreTouching;
    this.handsAreTouching = distance < collisionThreshold;

    // Trigger mixing effect on collision start
    if (this.handsAreTouching && !wasTouch && this.handCollisionCooldown <= 0 && chargeLevel > 0) {
      this.triggerHandMixingEffect(handPositions, chargeLevel, time);
      this.handCollisionCooldown = 0.3; // 300ms cooldown between triggers
    }

    // Continuous mixing while touching
    if (this.handsAreTouching && chargeLevel > 0) {
      this.updateContinuousMixing(handPositions, chargeLevel, time);
    }
  }

  // Trigger dramatic effect when hands first touch
  triggerHandMixingEffect(handPositions, chargeLevel, time) {
    console.log('HANDS COLLIDED! Charge level:', chargeLevel);

    // Calculate midpoint
    const midX = (handPositions.left.x + handPositions.right.x) / 2;
    const midY = (handPositions.left.y + handPositions.right.y) / 2;

    // Trigger particle burst at collision point
    if (this.particleSystem.spawnCollisionBurst) {
      this.particleSystem.spawnCollisionBurst(midX, midY, chargeLevel);
    }

    // Trigger screen shake proportional to charge
    this.scene.triggerPowerShake(0.5 + chargeLevel * 0.3);

    // Notify hand orb renderer for visual effect
    this.handOrbRenderer.onHandsCollide?.(midX, midY, chargeLevel);

    // Point cloud burst from collision point
    this.pointCloudBody.triggerCollisionBurst?.(midX, midY, chargeLevel);
  }

  // Continuous mixing effect while hands are touching
  updateContinuousMixing(handPositions, chargeLevel, time) {
    const midX = (handPositions.left.x + handPositions.right.x) / 2;
    const midY = (handPositions.left.y + handPositions.right.y) / 2;

    // Spawn swirling particles at contact point
    if (this.particleSystem.spawnMixingParticles) {
      this.particleSystem.spawnMixingParticles(midX, midY, chargeLevel, time);
    }
  }

  dispose() {
    this.isRunning = false;
    this.mediaPipe.dispose();
    this.bodyRenderer?.dispose();
    this.pointCloudBody?.dispose();
    this.handRenderer?.dispose();
    this.handOrbRenderer?.dispose();
    this.particleSystem?.dispose();
    this.backgroundEffects?.dispose();
    this.brushes?.dispose();
    this.scene.dispose();
  }
}
