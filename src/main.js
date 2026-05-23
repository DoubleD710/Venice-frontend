import { createWaterCanvas } from './canvas/water.js';
import { initFusionBox } from './components/fusion-box.js';
import { initModeToggle } from './components/mode-toggle.js';
import { initParticleRipple } from './components/particle-ripple.js';

// App entrypoint: keep startup wiring visible and easy to follow.
const water = createWaterCanvas(document.querySelector('[data-water-canvas]'));
const fusionBox = document.querySelector('[data-fusion-box]');

initFusionBox(fusionBox);
initModeToggle(document.querySelector('[data-mode-toggle]'));
initParticleRipple(fusionBox);

document.addEventListener('venice:ripple', (event) => {
  water.ripple(event.detail.x, event.detail.y, event.detail.strength);
});

water.start();
