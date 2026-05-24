import { createWaterCanvas } from './canvas/water.js';
import { initFusionBox } from './components/fusion-box.js';
import { initModeToggle } from './components/mode-toggle.js';
import { initResponsePanel } from './components/response-panel.js';
import { initDebugOverlay } from './components/debug-overlay.js';
import { createTokenStream } from './utils/token-stream.js';

// App entrypoint: keep startup wiring visible and easy to follow.
const water = createWaterCanvas(document.querySelector('[data-water-canvas]'));
const fusionBox = document.querySelector('[data-fusion-box]');
const responsePanel = initResponsePanel(document.querySelector('[data-response-panel]'));
const tokenStream = createTokenStream(fusionBox);
const debugOverlay = initDebugOverlay();
const debugState = {
  provider: 'None',
  state: 'idle',
  tokenCount: 0,
  duration: '0.0s',
  fps: 0,
  rippleCount: 0,
  visualMode: document.documentElement.dataset.visualMode || 'silver',
  endpointUrl: 'Not connected'
};

function formatDuration(duration) {
  return `${(duration / 1000).toFixed(1)}s`;
}

function updateDebugOverlay(nextState) {
  Object.assign(debugState, nextState);
  debugOverlay.update(debugState);
}

initFusionBox(fusionBox);
initModeToggle(document.querySelector('[data-mode-toggle]'));

document.documentElement.addEventListener('venice:visual-mode', (event) => {
  updateDebugOverlay({ visualMode: event.detail.mode });
});

water.onStats((stats) => {
  updateDebugOverlay({
    fps: stats.fps,
    rippleCount: stats.rippleCount
  });
});

document.addEventListener('venice:ripple', (event) => {
  water.ripple(event.detail.x, event.detail.y, event.detail.strength);
});

document.addEventListener('venice:send', (event) => {
  if (!responsePanel) {
    return;
  }

  responsePanel.open();
  responsePanel.clear();
  responsePanel.setStatus('Connecting');
  updateDebugOverlay({
    provider: 'None',
    state: 'streaming',
    tokenCount: 0,
    duration: '0.0s',
    endpointUrl: 'Connecting'
  });

  tokenStream.start(event.detail.prompt, {
    onStart() {
      responsePanel.setStreaming(true);
    },
    onStatus(status) {
      responsePanel.setStatus(status.message || status.state);
      updateDebugOverlay({
        provider: status.provider,
        state: status.state,
        tokenCount: status.tokenCount,
        duration: formatDuration(status.duration),
        endpointUrl: status.endpointUrl
      });
    },
    onMetrics(metrics) {
      updateDebugOverlay({
        tokenCount: metrics.tokenCount,
        duration: formatDuration(metrics.duration)
      });
    },
    onToken(token) {
      responsePanel.appendToken(token);
    },
    onDone(status) {
      responsePanel.setStreaming(false);
      responsePanel.setStatus(status.message || 'Complete');
    },
    onStop(status) {
      responsePanel.setStreaming(false);
      responsePanel.setStatus(status.message || 'Stopped');
    },
    onError(status) {
      responsePanel.setStreaming(false);
      responsePanel.clear();
      responsePanel.appendToken(status.message);
    }
  });
});

document.addEventListener('venice:stop-generation', () => {
  if (!responsePanel) {
    return;
  }

  tokenStream.stop();
});

water.start();
