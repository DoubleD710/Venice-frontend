import { createRippleEmitter } from '../utils/ripple-emitter.js';

// Small helper for modules that need to emit a one-off ripple.
export function emitParticleRipple(element, x, y, strength = 1) {
  if (!element) {
    return null;
  }

  const rippleEmitter = createRippleEmitter(element);
  rippleEmitter.emit(x, y, strength);
  return rippleEmitter;
}
