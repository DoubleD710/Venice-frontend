import { createWaterCanvas } from './canvas/water.js';
import { initFusionBox } from './components/fusion-box.js';
import { initModeToggle } from './components/mode-toggle.js';
import { initResponsePanel } from './components/response-panel.js';
import { createTokenStream } from './utils/token-stream.js';

// App entrypoint: keep startup wiring visible and easy to follow.
const water = createWaterCanvas(document.querySelector('[data-water-canvas]'));
const fusionBox = document.querySelector('[data-fusion-box]');
const responsePanel = initResponsePanel(document.querySelector('[data-response-panel]'));
const tokenStream = createTokenStream(fusionBox);

initFusionBox(fusionBox);
initModeToggle(document.querySelector('[data-mode-toggle]'));

document.addEventListener('venice:ripple', (event) => {
  water.ripple(event.detail.x, event.detail.y, event.detail.strength);
});

document.addEventListener('venice:send', (event) => {
  if (!responsePanel) {
    return;
  }

  responsePanel.open();
  responsePanel.clear();
  responsePanel.setStatus('Streaming');

  tokenStream.start(event.detail.prompt, {
    onStart() {
      responsePanel.setStreaming(true);
    },
    onToken(token) {
      responsePanel.appendToken(token);
    },
    onDone() {
      responsePanel.setStreaming(false);
      responsePanel.setStatus('Complete');
    }
  });
});

document.addEventListener('venice:stop-generation', () => {
  if (!responsePanel) {
    return;
  }

  tokenStream.stop(() => {
    responsePanel.setStreaming(false);
    responsePanel.setStatus('Stopped');
  });
});

water.start();
