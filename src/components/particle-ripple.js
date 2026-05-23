import { createRippleEmitter } from '../utils/ripple-emitter.js';

// UI-facing ripple hook; rendering can move to canvas as the effect grows.
export function initParticleRipple(element) {
  if (!element) {
    return null;
  }

  const rippleEmitter = createRippleEmitter(element);

  element.addEventListener('pointerdown', (event) => {
    rippleEmitter.emit(event.clientX, event.clientY, 1);
  });

  return rippleEmitter;
}
