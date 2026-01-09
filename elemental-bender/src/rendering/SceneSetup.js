// Three.js Scene Setup with WebGPU support
import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';

export class SceneSetup {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.width = 0;
    this.height = 0;
    this.isWebGPU = false;
    this.clock = new THREE.Clock();
    this.debugMesh = null;
  }

  async initialize(canvasElement) {
    this.canvas = canvasElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);

    // Create orthographic camera for 2D rendering
    // OrthographicCamera(left, right, top, bottom, near, far)
    // top > bottom for Y-up coordinate system
    this.camera = new THREE.OrthographicCamera(
      0, this.width,
      this.height, 0,  // top=height, bottom=0 (Y increases upward)
      -1000, 1000
    );
    this.camera.position.z = 100;

    // Try WebGPU first, fall back to WebGL2
    await this.createRenderer();

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());

    // Add debug indicator to verify rendering works
    this.createDebugIndicator();

    console.log(`Renderer initialized: ${this.isWebGPU ? 'WebGPU' : 'WebGL2'}`);
    console.log(`Scene dimensions: ${this.width}x${this.height}`);
    return true;
  }

  createDebugIndicator() {
    // Small pulsing circle in corner to confirm rendering is working
    const geometry = new THREE.RingGeometry(8, 12, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.position.set(30, this.height - 30, 50);
    this.scene.add(this.debugMesh);
    console.log('Debug indicator added at', this.debugMesh.position);
  }

  updateDebugIndicator(time) {
    if (this.debugMesh) {
      // Pulse the debug indicator
      this.debugMesh.material.opacity = 0.3 + Math.sin(time * 3) * 0.3;
    }
  }

  async createRenderer() {
    // Use WebGL2 renderer (stable, wide browser support)
    // WebGPU upgrade path: three/addons/renderers/webgpu/WebGPURenderer.js when needed
    this.createWebGLRenderer();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  createWebGLRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.isWebGPU = false;
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Update camera (maintain Y-up: top=height, bottom=0)
    this.camera.right = this.width;
    this.camera.top = this.height;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    // Update debug indicator
    this.updateDebugIndicator(this.getElapsedTime());
    this.renderer.render(this.scene, this.camera);
  }

  getDeltaTime() {
    return this.clock.getDelta();
  }

  getElapsedTime() {
    return this.clock.getElapsedTime();
  }

  // Add object to scene
  add(object) {
    this.scene.add(object);
  }

  // Remove object from scene
  remove(object) {
    this.scene.remove(object);
  }

  // Convert normalized coordinates (0-1) to screen coordinates
  normalizedToScreen(x, y, mirror = CONFIG.MIRROR_MODE) {
    const screenX = mirror ? (1 - x) * this.width : x * this.width;
    const screenY = (1 - y) * this.height; // Flip Y for screen coordinates
    return { x: screenX, y: screenY };
  }

  // Convert screen coordinates to normalized
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

  dispose() {
    this.renderer.dispose();
  }
}
