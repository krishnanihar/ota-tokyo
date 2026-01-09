// Input Manager - Keyboard controls
import { KEYBOARD_CONTROLS, CONFIG } from '../config.js';

export class InputManager {
  constructor() {
    this.callbacks = new Map();
    this.isFullscreen = false;
    this.isMirrored = CONFIG.MIRROR_MODE;
    this.isDebugVisible = false;

    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const action = KEYBOARD_CONTROLS[key] || KEYBOARD_CONTROLS[event.key];

    // Element switching with number keys 3-6
    if (event.key >= '3' && event.key <= '6') {
      event.preventDefault();
      const elements = ['fire', 'water', 'earth', 'air'];
      const index = parseInt(event.key) - 3;
      this.emit('elementChange', elements[index]);
      console.log(`Manual element switch: ${elements[index]}`);
      return;
    }

    // Skip to next element with space
    if (event.key === ' ') {
      event.preventDefault();
      this.emit('skipElement');
      return;
    }

    if (!action) return;

    // Prevent default for our keys
    event.preventDefault();

    // Parse action
    if (action.startsWith('setMode:')) {
      const mode = action.split(':')[1];
      this.emit('modeChange', mode);
    } else {
      switch (action) {
        case 'toggleDebug':
          this.isDebugVisible = !this.isDebugVisible;
          this.emit('toggleDebug', this.isDebugVisible);
          break;
        case 'toggleFullscreen':
          this.toggleFullscreen();
          break;
        case 'toggleMirror':
          this.isMirrored = !this.isMirrored;
          this.emit('toggleMirror', this.isMirrored);
          break;
        case 'exitFullscreen':
          if (this.isFullscreen) {
            document.exitFullscreen();
          }
          break;
      }
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  onFullscreenChange() {
    this.isFullscreen = !!document.fullscreenElement;
    this.emit('fullscreenChange', this.isFullscreen);
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(cb => cb(data));
    }
  }

  getMirrorMode() {
    return this.isMirrored;
  }

  getDebugVisible() {
    return this.isDebugVisible;
  }
}
