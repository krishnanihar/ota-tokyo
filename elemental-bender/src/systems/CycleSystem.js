// Cycle System - Element rotation timer with smooth transitions
import { CONFIG, ElementType } from '../config.js';

export class CycleSystem {
  constructor() {
    this.elements = CONFIG.ELEMENT_ORDER;
    this.currentIndex = 0;
    this.timer = 0;
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.isEnabled = true;
    this.lastUpdateTime = null; // Track time ourselves

    // Callbacks
    this.onElementChange = null;
    this.onTransitionStart = null;
    this.onTransitionProgress = null;
    this.onTransitionEnd = null;
  }

  update(deltaTime) {
    if (!this.isEnabled) {
      return;
    }

    // Use our own time tracking instead of relying on deltaTime
    const now = performance.now();
    if (this.lastUpdateTime === null) {
      this.lastUpdateTime = now;
      console.log('[CYCLE] Started - will switch every ' + (CONFIG.ELEMENT_DURATION / 1000) + 's');
      return;
    }

    const elapsed = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    this.timer += elapsed; // Already in milliseconds

    // Debug: log timer every 5 seconds
    const interval = 5000;
    const prevInterval = Math.floor((this.timer - elapsed) / interval);
    const currInterval = Math.floor(this.timer / interval);
    if (currInterval !== prevInterval) {
      console.log('[CYCLE] ' + Math.floor(this.timer / 1000) + 's / ' + (CONFIG.ELEMENT_DURATION / 1000) + 's - ' + this.getCurrentElement());
    }

    // Check for transition start
    const transitionStart = CONFIG.ELEMENT_DURATION - CONFIG.TRANSITION_DURATION;
    if (this.timer >= transitionStart && !this.isTransitioning) {
      this.startTransition();
    }

    // Update transition progress
    if (this.isTransitioning) {
      this.transitionProgress = (this.timer - transitionStart) / CONFIG.TRANSITION_DURATION;
      this.transitionProgress = Math.min(1, Math.max(0, this.transitionProgress));

      if (this.onTransitionProgress) {
        this.onTransitionProgress(this.transitionProgress, this.getCurrentElement(), this.getNextElement());
      }
    }

    // Check for element change
    if (this.timer >= CONFIG.ELEMENT_DURATION) {
      this.completeTransition();
    }

    return {
      currentElement: this.getCurrentElement(),
      nextElement: this.getNextElement(),
      timeRemaining: CONFIG.ELEMENT_DURATION - this.timer,
      isTransitioning: this.isTransitioning,
      transitionProgress: this.transitionProgress
    };
  }

  startTransition() {
    this.isTransitioning = true;
    this.transitionProgress = 0;

    if (this.onTransitionStart) {
      this.onTransitionStart(this.getCurrentElement(), this.getNextElement());
    }

    console.log(`Starting transition: ${this.getCurrentElement()} -> ${this.getNextElement()}`);
  }

  completeTransition() {
    const previousElement = this.getCurrentElement();
    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    this.timer = 0;
    this.isTransitioning = false;
    this.transitionProgress = 0;

    console.log(`=== ELEMENT TRANSITION: ${previousElement} -> ${this.getCurrentElement()} ===`);

    if (this.onTransitionEnd) {
      this.onTransitionEnd(previousElement, this.getCurrentElement());
    }

    if (this.onElementChange) {
      console.log('Calling onElementChange callback...');
      this.onElementChange(this.getCurrentElement(), previousElement);
    } else {
      console.warn('WARNING: onElementChange callback not set!');
    }
  }

  getCurrentElement() {
    return this.elements[this.currentIndex];
  }

  getNextElement() {
    return this.elements[(this.currentIndex + 1) % this.elements.length];
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  getTimeRemaining() {
    return Math.max(0, CONFIG.ELEMENT_DURATION - this.timer);
  }

  getProgress() {
    return this.timer / CONFIG.ELEMENT_DURATION;
  }

  // Force change to specific element
  setElement(elementType) {
    const index = this.elements.indexOf(elementType);
    if (index !== -1) {
      const previousElement = this.getCurrentElement();
      this.currentIndex = index;
      this.timer = 0;
      this.isTransitioning = false;
      this.transitionProgress = 0;

      if (this.onElementChange) {
        this.onElementChange(elementType, previousElement);
      }
    }
  }

  // Skip to next element immediately
  skipToNext() {
    this.timer = CONFIG.ELEMENT_DURATION;
    this.completeTransition();
  }

  // Enable/disable cycling
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Reset to first element
  reset() {
    this.currentIndex = 0;
    this.timer = 0;
    this.isTransitioning = false;
    this.transitionProgress = 0;
  }

  // For training mode: quick cycle through all elements
  setQuickCycle(duration = 10000) {
    // Temporarily override element duration
    this.quickCycleDuration = duration;
  }

  // Get interpolated colors during transition
  getTransitionColors(fromColors, toColors) {
    if (!this.isTransitioning) {
      return fromColors;
    }

    const t = this.easeInOutCubic(this.transitionProgress);

    return {
      primary: this.lerpHex(fromColors.primary, toColors.primary, t),
      secondary: this.lerpHex(fromColors.secondary, toColors.secondary, t),
      accent: this.lerpHex(fromColors.accent, toColors.accent, t),
      glow: this.lerpHex(fromColors.glow, toColors.glow, t)
    };
  }

  // Easing function for smooth transitions
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Lerp between hex colors
  lerpHex(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);

    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
