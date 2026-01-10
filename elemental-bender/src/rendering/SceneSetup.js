// Three.js Scene Setup with WebGPU support and WebGL2 fallback
// Phase 1: WebGPU Migration for GPU compute particles

import { CONFIG, COLORS } from '../config.js';

// Dynamic imports will be resolved based on renderer type
let THREE;
let isWebGPUAvailable = false;

// Check WebGPU availability
async function checkWebGPU() {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        if (device) {
          return true;
        }
      }
    } catch (e) {
      console.warn('WebGPU check failed:', e);
    }
  }
  return false;
}

export class SceneSetup {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.width = 0;
    this.height = 0;
    this.isWebGPU = false;
    this.clock = null;
    this.debugMesh = null;

    // Post-processing (WebGPU native or WebGL composer)
    this.postProcessing = null;
    this.composer = null;
    this.trailIntensity = 0.92;

    // TSL nodes (WebGPU only)
    this.tsl = null;

    // Screen shake system
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeStartTime = 0;
    this.originalCameraPos = null;

    // Chromatic aberration pass
    this.chromaticPass = null;
  }

  async initialize(canvasElement) {
    this.canvas = canvasElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Check WebGPU availability and import appropriate modules
    // NOTE: WebGPU is disabled for now because BodyRenderer uses ShaderMaterial
    // which is not compatible with WebGPU's node-based material system.
    // TODO: Convert all materials to node-based materials to enable WebGPU
    isWebGPUAvailable = false; // await checkWebGPU();

    if (isWebGPUAvailable) {
      try {
        console.log('WebGPU available - attempting GPU compute shaders');
        await this.initializeWebGPU();
      } catch (webgpuError) {
        console.warn('WebGPU initialization failed, falling back to WebGL2:', webgpuError);
        isWebGPUAvailable = false;
        this.isWebGPU = false;
        await this.initializeWebGL();
      }
    } else {
      console.log('Using WebGL2 renderer (WebGPU disabled - ShaderMaterial compatibility)');
      await this.initializeWebGL();
    }

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());

    // Add debug indicator
    this.createDebugIndicator();

    console.log(`Renderer initialized: ${this.isWebGPU ? 'WebGPU' : 'WebGL2'}`);
    console.log(`Scene dimensions: ${this.width}x${this.height}`);
    return true;
  }

  async initializeWebGPU() {
    // Import WebGPU version of Three.js
    const threeModule = await import('three/webgpu');
    THREE = threeModule;

    // Import TSL nodes for compute shaders
    this.tsl = await import('three/tsl');

    this.isWebGPU = true;
    this.clock = new THREE.Clock();

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent - CSS gradient shows through

    // Create orthographic camera for 2D rendering
    this.camera = new THREE.OrthographicCamera(
      0, this.width,
      this.height, 0,
      -1000, 1000
    );
    this.camera.position.z = 100;

    // Create WebGPU renderer
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true // Allow transparency
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);

    // Setup WebGPU native post-processing
    await this.setupWebGPUPostProcessing();

    console.log('WebGPU renderer created with TSL support');
  }

  async initializeWebGL() {
    // Import standard Three.js
    const threeModule = await import('three');
    THREE = threeModule;

    this.isWebGPU = false;
    this.clock = new THREE.Clock();

    // Create scene
    this.scene = new THREE.Scene();

    // Create orthographic camera for 2D rendering
    this.camera = new THREE.OrthographicCamera(
      0, this.width,
      this.height, 0,
      -1000, 1000
    );
    this.camera.position.z = 100;

    // Create WebGL2 renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);

    // Create gradient background (Ota Tokyo style - deep blue/purple to lighter purple)
    this.createGradientBackground();

    // Setup WebGL post-processing with EffectComposer
    await this.setupWebGLPostProcessing();

    console.log('WebGL2 renderer created');
  }

  async setupWebGPUPostProcessing() {
    try {
      // Check if PostProcessing is available
      if (!THREE.PostProcessing) {
        console.warn('THREE.PostProcessing not available, skipping post-processing');
        return;
      }

      // Check if TSL pass function is available
      if (!this.tsl?.pass) {
        console.warn('TSL pass function not available, skipping post-processing');
        return;
      }

      const { pass } = this.tsl;

      this.postProcessing = new THREE.PostProcessing(this.renderer);

      // Create scene pass
      const scenePass = pass(this.scene, this.camera);

      // For now, just output the scene directly
      // Bloom can be added later with proper TSL bloom node
      this.postProcessing.outputNode = scenePass;

      console.log('WebGPU post-processing configured');
    } catch (error) {
      console.warn('WebGPU post-processing setup failed, will use direct rendering:', error);
      this.postProcessing = null;
    }
  }

  async setupWebGLPostProcessing() {
    // WebGL uses EffectComposer
    const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
    const { AfterimagePass } = await import('three/addons/postprocessing/AfterimagePass.js');
    const { ShaderPass } = await import('three/addons/postprocessing/ShaderPass.js');
    const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');

    this.composer = new EffectComposer(this.renderer);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Trail/afterimage effect - VERY LOW for responsive silhouette
    this.afterimagePass = new AfterimagePass();
    this.afterimagePass.uniforms['damp'].value = 0.12; // Minimal ghosting - silhouette updates dynamically
    this.composer.addPass(this.afterimagePass);

    // METABALL DISABLED - was creating mushy blobs instead of sharp Ukiyo-e style
    // this.metaballPass = new ShaderPass(this.createMetaballShader());
    // this.composer.addPass(this.metaballPass);
    this.metaballPass = null;

    // Bloom - SELECTIVE GLOW for energy effects
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      0.3,   // strength - moderate glow
      0.4,   // radius - tighter glow
      0.7    // threshold - only bright areas glow
    );
    this.composer.addPass(this.bloomPass);

    // Chromatic aberration pass - for AVATAR state power effect
    this.chromaticPass = new ShaderPass(this.createChromaticAberrationShader());
    this.chromaticPass.uniforms.intensity.value = 0.0; // Disabled by default
    this.composer.addPass(this.chromaticPass);

    // Output pass for proper color space
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    console.log('WebGL post-processing configured with chromatic aberration');
  }

  createChromaticAberrationShader() {
    return {
      uniforms: {
        tDiffuse: { value: null },
        intensity: { value: 0.0 },
        direction: { value: new THREE.Vector2(1.0, 0.5) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float intensity;
        uniform vec2 direction;
        varying vec2 vUv;

        void main() {
          vec2 offset = intensity * normalize(direction) * 0.01;

          // Sample each color channel with offset
          float r = texture2D(tDiffuse, vUv + offset).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv - offset).b;
          float a = texture2D(tDiffuse, vUv).a;

          gl_FragColor = vec4(r, g, b, a);
        }
      `
    };
  }

  createMetaballShader() {
    // Metaball shader creates organic blob shapes from particles
    // Inspired by marching squares / threshold techniques
    return {
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        threshold: { value: 0.15 },
        smoothness: { value: 0.08 },
        edgeStrength: { value: 0.3 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float threshold;
        uniform float smoothness;
        uniform float edgeStrength;

        varying vec2 vUv;

        // Sample with small blur for metaball effect
        vec4 sampleBlurred(vec2 uv, float radius) {
          vec4 color = vec4(0.0);
          vec2 texel = 1.0 / resolution;

          // 9-tap blur
          for (float x = -1.0; x <= 1.0; x += 1.0) {
            for (float y = -1.0; y <= 1.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texel * radius;
              color += texture2D(tDiffuse, uv + offset);
            }
          }
          return color / 9.0;
        }

        void main() {
          vec4 original = texture2D(tDiffuse, vUv);
          vec4 blurred = sampleBlurred(vUv, 2.0);

          // Calculate luminance for thresholding
          float lum = dot(blurred.rgb, vec3(0.299, 0.587, 0.114));

          // Soft threshold for metaball-like edges
          float blob = smoothstep(threshold - smoothness, threshold + smoothness, lum);

          // Edge detection for ukiyo-e outline effect
          float lumLeft = dot(sampleBlurred(vUv - vec2(2.0/resolution.x, 0.0), 1.5).rgb, vec3(0.299, 0.587, 0.114));
          float lumRight = dot(sampleBlurred(vUv + vec2(2.0/resolution.x, 0.0), 1.5).rgb, vec3(0.299, 0.587, 0.114));
          float lumUp = dot(sampleBlurred(vUv + vec2(0.0, 2.0/resolution.y), 1.5).rgb, vec3(0.299, 0.587, 0.114));
          float lumDown = dot(sampleBlurred(vUv - vec2(0.0, 2.0/resolution.y), 1.5).rgb, vec3(0.299, 0.587, 0.114));

          float edge = abs(lumLeft - lumRight) + abs(lumUp - lumDown);
          edge = smoothstep(0.05, 0.2, edge);

          // Combine: original color weighted by blob, with edge darkening
          vec3 color = original.rgb * blob;

          // Add subtle edge outline (darker at edges for woodblock look)
          color = mix(color, color * 0.3, edge * edgeStrength);

          // Boost color saturation slightly for more graphic look
          float gray = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(vec3(gray), color, 1.2);

          gl_FragColor = vec4(color, original.a);
        }
      `
    };
  }

  createDebugIndicator() {
    // Small pulsing indicator to confirm rendering
    const geometry = new THREE.RingGeometry(8, 12, 32);
    const material = new THREE.MeshBasicMaterial({
      color: this.isWebGPU ? 0x00ffff : 0x00ff00, // Cyan for WebGPU, Green for WebGL
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.position.set(30, this.height - 30, 50);
    this.scene.add(this.debugMesh);

    console.log('Renderer initialized:', {
      isWebGPU: this.isWebGPU,
      rendererType: this.renderer.constructor.name
    });
  }

  updateDebugIndicator(time) {
    if (this.debugMesh) {
      this.debugMesh.material.opacity = 0.3 + Math.sin(time * 3) * 0.3;
    }
  }

  setTrailIntensity(intensity) {
    this.trailIntensity = Math.max(0, Math.min(1, intensity));
    if (this.afterimagePass) {
      this.afterimagePass.uniforms['damp'].value = this.trailIntensity;
    }
  }

  // Clear afterimage buffer - call on element change to prevent color ghosting
  clearAfterimage() {
    if (this.afterimagePass) {
      // Temporarily set damp to 0 to flush the buffer over next few frames
      const originalDamp = this.afterimagePass.uniforms['damp'].value;
      this.afterimagePass.uniforms['damp'].value = 0;

      // Restore after a short delay
      setTimeout(() => {
        if (this.afterimagePass) {
          this.afterimagePass.uniforms['damp'].value = originalDamp;
        }
      }, 100); // 100ms = ~6 frames at 60fps
    }
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Update camera
    this.camera.right = this.width;
    this.camera.top = this.height;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(this.width, this.height);

    // Update post-processing
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(this.width, this.height);
    }
    if (this.metaballPass) {
      this.metaballPass.uniforms.resolution.value.set(this.width, this.height);
    }

    // Update debug indicator position
    if (this.debugMesh) {
      this.debugMesh.position.y = this.height - 30;
    }

    // Update gradient background
    if (this.gradientMesh) {
      this.gradientMesh.geometry.dispose();
      this.gradientMesh.geometry = new THREE.PlaneGeometry(this.width, this.height);
      this.gradientMesh.position.set(this.width / 2, this.height / 2, -900);
    }
  }

  render() {
    this.updateDebugIndicator(this.getElapsedTime());
    this.updateScreenShake();

    if (this.isWebGPU && this.postProcessing) {
      // WebGPU native rendering
      this.postProcessing.render();
    } else if (this.composer) {
      // WebGL with EffectComposer
      this.composer.render();
    } else {
      // Fallback direct render
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Async render for WebGPU (supports compute shaders)
  async renderAsync() {
    this.updateDebugIndicator(this.getElapsedTime());

    if (this.isWebGPU) {
      await this.renderer.renderAsync(this.scene, this.camera);
    } else {
      this.render();
    }
  }

  // Execute compute shader (WebGPU only)
  async compute(computeNode) {
    if (this.isWebGPU && this.renderer.compute) {
      await this.renderer.compute(computeNode);
    }
  }

  getDeltaTime() {
    return this.clock.getDelta();
  }

  getElapsedTime() {
    return this.clock.getElapsedTime();
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

  normalizedToScreen(x, y, mirror = CONFIG.MIRROR_MODE) {
    const screenX = mirror ? (1 - x) * this.width : x * this.width;
    const screenY = (1 - y) * this.height;
    return { x: screenX, y: screenY };
  }

  screenToNormalized(x, y, mirror = CONFIG.MIRROR_MODE) {
    const normX = mirror ? 1 - (x / this.width) : x / this.width;
    const normY = 1 - (y / this.height);
    return { x: normX, y: normY };
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  getAspect() {
    return this.width / this.height;
  }

  // Get TSL module (WebGPU only)
  getTSL() {
    return this.tsl;
  }

  // Get THREE module (for compatibility)
  getTHREE() {
    return THREE;
  }

  // Check if WebGPU is active
  hasWebGPU() {
    return this.isWebGPU;
  }

  // ===========================================
  // AVATAR STATE SCREEN EFFECTS
  // ===========================================

  startScreenShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeStartTime = this.getElapsedTime();
    this.originalCameraPos = this.camera.position.clone();
  }

  updateScreenShake() {
    if (this.shakeIntensity <= 0) return;

    const elapsed = this.getElapsedTime() - this.shakeStartTime;

    if (elapsed > this.shakeDuration) {
      // Shake finished - restore camera
      if (this.originalCameraPos) {
        this.camera.position.copy(this.originalCameraPos);
      }
      this.shakeIntensity = 0;
      return;
    }

    // Decay shake over duration
    const decay = 1 - (elapsed / this.shakeDuration);

    // Random offset based on intensity
    const offsetX = (Math.random() - 0.5) * this.shakeIntensity * decay * this.width * 0.5;
    const offsetY = (Math.random() - 0.5) * this.shakeIntensity * decay * this.height * 0.5;

    // Apply shake offset to camera
    if (this.originalCameraPos) {
      this.camera.position.x = this.originalCameraPos.x + offsetX;
      this.camera.position.y = this.originalCameraPos.y + offsetY;
    }
  }

  setAvatarEffects(active, intensity = 1.0) {
    // Unified control for all AVATAR state effects

    // Chromatic aberration
    if (this.chromaticPass) {
      this.chromaticPass.uniforms.intensity.value = active ? 0.8 * intensity : 0;

      // Vary direction for more dynamic effect
      if (active) {
        const time = this.getElapsedTime();
        this.chromaticPass.uniforms.direction.value.set(
          Math.sin(time * 2) * 0.5 + 1.0,
          Math.cos(time * 1.5) * 0.3 + 0.5
        );
      }
    }

    // Boost bloom during AVATAR state
    if (this.bloomPass) {
      this.bloomPass.strength = active ? 0.5 + intensity * 0.4 : 0.3;
    }

    // Trigger screen shake (subtle continuous shake at AVATAR)
    if (active && this.shakeIntensity <= 0) {
      this.startScreenShake(0.015 * intensity, 0.15);
    }
  }

  // Trigger a powerful shake (for burst releases)
  triggerPowerShake(intensity = 1.0) {
    this.startScreenShake(0.04 * intensity, 0.3);
  }

  // Continuous AVATAR effect animation (called every frame while in AVATAR state)
  updateAvatarEffects(time) {
    // Animate chromatic aberration direction for dynamic pulsing effect
    if (this.chromaticPass) {
      // Pulsing intensity
      const pulseIntensity = 0.6 + Math.sin(time * 4) * 0.3;
      this.chromaticPass.uniforms.intensity.value = pulseIntensity;

      // Rotating direction creates swirling color fringe
      this.chromaticPass.uniforms.direction.value.set(
        Math.sin(time * 2) * 0.8 + 0.5,
        Math.cos(time * 1.7) * 0.6 + 0.3
      );
    }

    // Pulsing bloom
    if (this.bloomPass) {
      const bloomPulse = 0.6 + Math.sin(time * 3) * 0.15;
      this.bloomPass.strength = bloomPulse;
    }

    // Subtle continuous screen shake
    if (this.shakeIntensity <= 0) {
      this.startScreenShake(0.008, 0.1);
    }
  }

  // ===========================================
  // GRADIENT BACKGROUND
  // ===========================================

  createGradientBackground() {
    // Ota Tokyo style gradient - deep blue/purple at bottom to lighter purple at top
    const geometry = new THREE.PlaneGeometry(this.width, this.height);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        // Colors from bottom to top
        colorBottom: { value: new THREE.Color(0x0f0c29) },  // Deep blue/purple
        colorMiddle: { value: new THREE.Color(0x302b63) },  // Mid purple
        colorTop: { value: new THREE.Color(0x24243e) }      // Lighter purple
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorBottom;
        uniform vec3 colorMiddle;
        uniform vec3 colorTop;
        varying vec2 vUv;

        void main() {
          // Two-stage gradient: bottom->middle->top
          vec3 color;
          if (vUv.y < 0.5) {
            // Bottom half: deep blue to mid purple
            color = mix(colorBottom, colorMiddle, vUv.y * 2.0);
          } else {
            // Top half: mid purple to lighter purple
            color = mix(colorMiddle, colorTop, (vUv.y - 0.5) * 2.0);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    this.gradientMesh = new THREE.Mesh(geometry, material);
    // Position at center of screen, far back
    this.gradientMesh.position.set(this.width / 2, this.height / 2, -900);
    this.scene.add(this.gradientMesh);

    console.log('Gradient background created (Ota Tokyo style)');
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose();
    }
    if (this.postProcessing) {
      // WebGPU PostProcessing cleanup
    }
    if (this.gradientMesh) {
      this.gradientMesh.geometry.dispose();
      this.gradientMesh.material.dispose();
      this.scene.remove(this.gradientMesh);
    }
    this.renderer.dispose();
  }
}
