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

function showError(message, details = '') {
  const loadingEl = document.getElementById('loading');
  loadingEl.innerHTML = `
    <div style="color: #E34234; font-size: 24px; margin-bottom: 10px;">Error</div>
    <div>${message}</div>
    ${details ? `<div style="margin-top: 10px; font-size: 12px; color: rgba(255,254,240,0.5); max-width: 500px; word-break: break-all;">${details}</div>` : ''}
    <div style="margin-top: 20px; font-size: 14px; color: rgba(255,254,240,0.6);">
      Please ensure camera permissions are granted and try refreshing the page.
      <br><br>
      Check browser console (F12) for detailed error information.
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
  console.error('Stack:', error.stack);
  showError(error.message, error.stack?.split('\n')[1] || '');
});
