import { createRippleEmitter } from '../utils/ripple-emitter.js';

// Owns the main input surface interactions without hiding simple DOM behavior.
export function initFusionBox(element) {
  if (!element) {
    return null;
  }

  const input = element.querySelector('[data-fusion-input]');
  const rippleEmitter = createRippleEmitter(element);

  if (!input) {
    return {
      element,
      input: null,
      setPrompt() {},
      send() {}
    };
  }

  function emitCenterRipple(strength = 1) {
    const box = element.getBoundingClientRect();

    rippleEmitter.emit(
      box.left + box.width * 0.5,
      box.top + box.height * 0.5,
      strength
    );
  }

  function sendPrompt() {
    const prompt = input.value.trim();

    if (!prompt) {
      emitCenterRipple(0.45);
      return;
    }

    element.dispatchEvent(new CustomEvent('venice:send', {
      bubbles: true,
      detail: { prompt }
    }));

    input.value = '';
    emitCenterRipple(1.35);
  }

  element.addEventListener('pointerdown', (event) => {
    rippleEmitter.emit(event.clientX, event.clientY, 0.85);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendPrompt();
  });

  return {
    element,
    input,
    setPrompt(prompt) {
      input.value = prompt || '';
    },
    send: sendPrompt
  };
}
