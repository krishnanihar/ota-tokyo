// Segmentation Mask Handler
// Processes MediaPipe segmentation mask into usable texture data

import { CONFIG } from '../config.js';

export class SegmentationMask {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.maskData = null;
    this.width = 0;
    this.height = 0;
    this.maskWidth = 0;  // Actual mask dimensions from MediaPipe
    this.maskHeight = 0;
    this.hasLoggedDimensions = false;
  }

  initialize(width, height) {
    this.width = width;
    this.height = height;

    // Create offscreen canvas for mask processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    console.log(`SegmentationMask: Initialized with target size ${width}x${height}`);
  }

  update(segmentationMask) {
    if (!segmentationMask || !this.ctx) {
      return null;
    }

    try {
      // Get mask data from MediaPipe result
      // MediaPipe returns mask as Float32Array
      const mask = segmentationMask.getAsFloat32Array();

      if (!mask) {
        console.warn('SegmentationMask: getAsFloat32Array returned null');
        return null;
      }

      // Get actual mask dimensions from MediaPipe
      this.maskWidth = segmentationMask.width;
      this.maskHeight = segmentationMask.height;

      // Log dimensions once
      if (!this.hasLoggedDimensions) {
        console.log(`SegmentationMask: Mask dimensions ${this.maskWidth}x${this.maskHeight}, target ${this.width}x${this.height}`);
        this.hasLoggedDimensions = true;
      }

      // Store raw mask data for particle collision checking
      this.maskData = mask;

      return mask;
    } catch (error) {
      console.error('SegmentationMask: Error processing mask:', error);
      return null;
    }
  }

  // Check if a point is inside the body mask
  isInsideBody(x, y) {
    if (!this.maskData || !this.maskWidth || !this.maskHeight) return false;

    // Convert normalized coordinates (0-1) to actual mask pixel coordinates
    const px = Math.floor(x * this.maskWidth);
    const py = Math.floor(y * this.maskHeight);

    // Bounds check
    if (px < 0 || px >= this.maskWidth || py < 0 || py >= this.maskHeight) {
      return false;
    }

    const index = py * this.maskWidth + px;
    return this.maskData[index] > CONFIG.MASK_THRESHOLD;
  }

  // Get mask value at a specific point (for gradient effects)
  getMaskValue(x, y) {
    if (!this.maskData || !this.maskWidth || !this.maskHeight) return 0;

    // Convert normalized coordinates (0-1) to actual mask pixel coordinates
    const px = Math.floor(x * this.maskWidth);
    const py = Math.floor(y * this.maskHeight);

    if (px < 0 || px >= this.maskWidth || py < 0 || py >= this.maskHeight) {
      return 0;
    }

    const index = py * this.maskWidth + px;
    return this.maskData[index] || 0;
  }

  // Get actual mask dimensions
  getMaskWidth() {
    return this.maskWidth || this.width;
  }

  getMaskHeight() {
    return this.maskHeight || this.height;
  }

  // Generate edge detection data for glow effects
  getEdgeMask() {
    if (!this.maskData || !this.maskWidth || !this.maskHeight) return null;

    const edgeMask = new Float32Array(this.maskData.length);
    const threshold = CONFIG.MASK_THRESHOLD;

    for (let y = 1; y < this.maskHeight - 1; y++) {
      for (let x = 1; x < this.maskWidth - 1; x++) {
        const idx = y * this.maskWidth + x;
        const current = this.maskData[idx] > threshold ? 1 : 0;

        // Check neighbors
        const left = this.maskData[idx - 1] > threshold ? 1 : 0;
        const right = this.maskData[idx + 1] > threshold ? 1 : 0;
        const top = this.maskData[idx - this.maskWidth] > threshold ? 1 : 0;
        const bottom = this.maskData[idx + this.maskWidth] > threshold ? 1 : 0;

        // Edge if current is inside but any neighbor is outside
        if (current === 1 && (left === 0 || right === 0 || top === 0 || bottom === 0)) {
          edgeMask[idx] = 1;
        }
      }
    }

    return edgeMask;
  }

  // Get random point inside the body mask
  getRandomInsidePoint() {
    if (!this.maskData) return null;

    // Try up to 100 times to find a valid point
    for (let i = 0; i < 100; i++) {
      const x = Math.random();
      const y = Math.random();

      if (this.isInsideBody(x, y)) {
        return { x, y };
      }
    }

    return null;
  }

  // Get points along body edge for aura effects
  getEdgePoints(count = 50) {
    const edgeMask = this.getEdgeMask();
    if (!edgeMask || !this.maskWidth || !this.maskHeight) return [];

    const points = [];
    const indices = [];

    // Collect all edge pixel indices
    for (let i = 0; i < edgeMask.length; i++) {
      if (edgeMask[i] > 0) {
        indices.push(i);
      }
    }

    // Sample evenly from edges
    const step = Math.max(1, Math.floor(indices.length / count));
    for (let i = 0; i < indices.length && points.length < count; i += step) {
      const idx = indices[i];
      // Return normalized coordinates (0-1)
      const x = (idx % this.maskWidth) / this.maskWidth;
      const y = Math.floor(idx / this.maskWidth) / this.maskHeight;
      points.push({ x, y });
    }

    return points;
  }

  // Render mask to canvas (for debug or texture generation)
  renderToCanvas(targetCanvas, color = '#FFFFFF') {
    if (!this.maskData || !targetCanvas) return;

    const targetCtx = targetCanvas.getContext('2d');
    const imageData = targetCtx.createImageData(this.width, this.height);
    const data = imageData.data;

    // Parse color
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    for (let i = 0; i < this.maskData.length; i++) {
      const alpha = Math.floor(this.maskData[i] * 255);
      const pixelIndex = i * 4;
      data[pixelIndex] = r;
      data[pixelIndex + 1] = g;
      data[pixelIndex + 2] = b;
      data[pixelIndex + 3] = alpha;
    }

    targetCtx.putImageData(imageData, 0, 0);
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  getRawData() {
    return this.maskData;
  }
}
