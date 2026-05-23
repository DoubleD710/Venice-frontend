// Tiny helpers for CSS custom properties used by visual systems.
export function setCssVar(name, value, target = document.documentElement) {
  target.style.setProperty(name, value);
}

export function getCssVar(name, target = document.documentElement) {
  return getComputedStyle(target).getPropertyValue(name).trim();
}
