import { setCssVar } from '../utils/css-vars.js';

// Small state toggle for future mode-aware visuals.
export function initModeToggle(button) {
  if (!button) {
    return null;
  }

  button.addEventListener('click', () => {
    const isActive = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!isActive));
    button.textContent = isActive ? 'Focus' : 'Drift';
    setCssVar('--color-accent', isActive ? '#8fd7c7' : '#d5b16f');
  });

  return button;
}
