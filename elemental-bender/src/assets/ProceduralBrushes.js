// Procedural Brushes - Generate Ukiyo-e style brush stroke textures
import * as THREE from 'three';

export class ProceduralBrushes {
  constructor() {
    this.textures = new Map();
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  initialize() {
    // Generate various brush stroke textures
    this.textures.set('stroke1', this.createBrushStroke(64, 64, 'round'));
    this.textures.set('stroke2', this.createBrushStroke(64, 32, 'elongated'));
    this.textures.set('stroke3', this.createBrushStroke(48, 48, 'splatter'));
    this.textures.set('dot', this.createBrushStroke(32, 32, 'dot'));
    this.textures.set('ember', this.createBrushStroke(24, 24, 'ember'));
  }

  createBrushStroke(width, height, style) {
    this.canvas.width = width;
    this.canvas.height = height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    switch (style) {
      case 'round':
        this.drawRoundBrush(width, height);
        break;
      case 'elongated':
        this.drawElongatedBrush(width, height);
        break;
      case 'splatter':
        this.drawSplatterBrush(width, height);
        break;
      case 'dot':
        this.drawDotBrush(width, height);
        break;
      case 'ember':
        this.drawEmberBrush(width, height);
        break;
    }

    // Create Three.js texture
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Clone the canvas data (canvas will be reused)
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const clonedCanvas = document.createElement('canvas');
    clonedCanvas.width = width;
    clonedCanvas.height = height;
    clonedCanvas.getContext('2d').putImageData(imageData, 0, 0);
    texture.image = clonedCanvas;

    return texture;
  }

  drawRoundBrush(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 2;

    // Gradient for ink-like feel
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Add some noise for paper texture feel
    this.addNoise(width, height, 0.1);
  }

  drawElongatedBrush(width, height) {
    const cx = width / 2;
    const cy = height / 2;

    // Horizontal elongated stroke
    this.ctx.save();
    this.ctx.translate(cx, cy);

    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.scale(1, 0.5); // Elongate horizontally
    this.ctx.beginPath();
    this.ctx.arc(0, 0, width / 2 - 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();

    // Add feathered edges like brush hair
    this.addBrushHair(width, height);
  }

  drawSplatterBrush(width, height) {
    const cx = width / 2;
    const cy = height / 2;

    // Main splatter
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 3);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, width / 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Add scattered droplets
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const dist = width / 3 + Math.random() * width / 4;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const r = 2 + Math.random() * 4;

      const dropGradient = this.ctx.createRadialGradient(x, y, 0, x, y, r);
      dropGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      dropGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = dropGradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawDotBrush(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 4;

    // Softer, more defined dot
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawEmberBrush(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 2;

    // Hot center, cooling edges (for fire embers)
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 200, 150, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Add slight glow halo
    const glowGradient = this.ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius);
    glowGradient.addColorStop(0, 'rgba(255, 200, 100, 0)');
    glowGradient.addColorStop(0.5, 'rgba(255, 150, 50, 0.2)');
    glowGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

    this.ctx.fillStyle = glowGradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  addNoise(width, height, amount) {
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) { // Only affect non-transparent pixels
        const noise = (Math.random() - 0.5) * amount * 255;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  addBrushHair(width, height) {
    // Add subtle brush hair marks at edges
    const cx = width / 2;
    const cy = height / 2;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 0.5;

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const innerR = width / 4;
      const outerR = width / 2 - 2;

      this.ctx.beginPath();
      this.ctx.moveTo(
        cx + Math.cos(angle) * innerR,
        cy + Math.sin(angle) * innerR * 0.5
      );
      this.ctx.lineTo(
        cx + Math.cos(angle + 0.1) * outerR,
        cy + Math.sin(angle + 0.1) * outerR * 0.5
      );
      this.ctx.stroke();
    }
  }

  getTexture(name) {
    return this.textures.get(name);
  }

  getRandomTexture() {
    const keys = Array.from(this.textures.keys());
    return this.textures.get(keys[Math.floor(Math.random() * keys.length)]);
  }

  dispose() {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
  }
}
