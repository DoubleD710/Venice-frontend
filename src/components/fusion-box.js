// Owns the main input surface without hiding simple DOM behavior.
export function initFusionBox(element) {
  if (!element) {
    return null;
  }

  const input = element.querySelector('[data-fusion-input]');

  return {
    element,
    input
  };
}
