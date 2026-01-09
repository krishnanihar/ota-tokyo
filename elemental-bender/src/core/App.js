// Main Application Orchestrator
import { CONFIG, COLORS, ElementType, ChargeState } from '../config.js';
import { MediaPipeSetup } from '../detection/MediaPipeSetup.js';
import { PoseProcessor } from '../detection/PoseProcessor.js';
import { SegmentationMask } from '../detection/SegmentationMask.js';
import { SceneSetup } from '../rendering/SceneSetup.js';
import { BodyRenderer } from '../rendering/BodyRenderer.js';
import { PointCloudBodyRenderer } from '../rendering/PointCloudBodyRenderer.js';
import { HandRenderer } from '../rendering/HandRenderer.js';
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
    this.particleSystem = null;
    this.chargeSystem = new ChargeSystem();
    this.cycleSystem = new CycleSystem();
    this.inputManager = new InputManager();
    this.brushes = new ProceduralBrushes();

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

      // Point cloud body renderer - DISABLED in favor of solid silhouette
      // Keeping initialization for potential hybrid mode later
      this.pointCloudBody = new PointCloudBodyRenderer(this.scene);
      this.pointCloudBody.initialize(this.scene.getWidth(), this.scene.getHeight());
      this.pointCloudBody.setElement(this.currentElement);
      // Hide point cloud - using solid body silhouette instead
      if (this.pointCloudBody.points) {
        this.pointCloudBody.points.visible = false;
      }

      // Solid body silhouette renderer - PRIMARY body visualization
      this.bodyRenderer = new BodyRenderer(this.scene);
      this.bodyRenderer.initialize(this.scene.getWidth(), this.scene.getHeight());
      this.bodyRenderer.setElement(this.currentElement);
      // Body silhouette is now visible - provides solid foundation for energy

      // Initialize hand renderer
      this.handRenderer = new HandRenderer(this.scene);
      this.handRenderer.initialize();
      this.handRenderer.setElement(this.currentElement);

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
      this.setElement(newElement);
    };

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

      // Update detection status
      if (hasLandmarks) {
        if (!this.isDetecting) {
          this.isDetecting = true;
          this.updateStatus('detecting', 'Tracking active');
        }
        this.framesWithoutDetection = 0;
      } else {
        this.framesWithoutDetection++;
        if (this.framesWithoutDetection > 30 && this.isDetecting) {
          this.isDetecting = false;
          this.updateStatus('searching', 'Looking for you...');
        }
      }

      // Update segmentation mask
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
        }
      }

      // Update charge system
      const chargeData = this.chargeSystem.update(poseData, deltaTime);

      if (chargeData) {
        this.bodyRenderer.setChargeLevel(chargeData.level);
        this.pointCloudBody.setChargeLevel(chargeData.level);
        this.handRenderer.setChargeLevel(chargeData.level);
        this.activeElement?.setChargeLevel(chargeData.level);

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
    this.bodyRenderer.update(time);
    this.pointCloudBody.update(time, deltaTime);
    this.handRenderer.update(time, this.lastPoseData?.hands, this.mirrorMode);

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
      // TODO: Trigger screen effects, eye glow, etc.
    }
  }

  onEnergyRelease(releaseData) {
    console.log('Energy released:', releaseData);

    // Trigger element's fast move effect
    if (this.lastPoseData && releaseData.isFastMove) {
      this.activeElement?.onFastMove(this.lastPoseData, releaseData);
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
    this.particleSystem.setElement(elementType);

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
  }

  dispose() {
    this.isRunning = false;
    this.mediaPipe.dispose();
    this.bodyRenderer?.dispose();
    this.pointCloudBody?.dispose();
    this.handRenderer?.dispose();
    this.particleSystem?.dispose();
    this.brushes?.dispose();
    this.scene.dispose();
  }
}
