// Shared event helper for ripple-like interactions.
export function createRippleEmitter(target) {
  return {
    emit(x, y, strength = 1) {
      target.dispatchEvent(new CustomEvent('venice:ripple', {
        bubbles: true,
        detail: { x, y, strength }
      }));
    }
  };
}
