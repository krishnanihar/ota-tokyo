// The Elemental Bender - Entry Point
import { App } from './core/App.js';

// Global app instance
let app = null;

async function init() {
  console.log('Starting The Elemental Bender...');

  // Check for required features
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Camera access is not supported in this browser');
    return;
  }

  // Create and initialize app
  app = new App();
  const success = await app.initialize();

  if (!success) {
    showError('Failed to initialize application');
  }
}

function showError(message) {
  const loadingEl = document.getElementById('loading');
  loadingEl.innerHTML = `
    <div style="color: #E34234; font-size: 24px; margin-bottom: 10px;">Error</div>
    <div>${message}</div>
    <div style="margin-top: 20px; font-size: 14px; color: rgba(255,254,240,0.6);">
      Please ensure camera permissions are granted and try refreshing the page.
    </div>
  `;
}

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (app) {
    app.dispose();
  }
});

// Start the application
init().catch(error => {
  console.error('Fatal error:', error);
  showError(error.message);
});
