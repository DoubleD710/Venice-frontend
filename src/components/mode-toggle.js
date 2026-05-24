// Small visual mode hook for silver and gold surface states.
export function initModeToggle(button) {
  if (!button) {
    return null;
  }

  const root = document.documentElement;

  function setMode(mode) {
    root.dataset.visualMode = mode;
    button.setAttribute('aria-pressed', String(mode === 'gold'));
    button.textContent = mode === 'gold' ? 'Gold' : 'Silver';
  }

  setMode(root.dataset.visualMode || 'silver');

  button.addEventListener('click', () => {
    const nextMode = root.dataset.visualMode === 'gold' ? 'silver' : 'gold';
    setMode(nextMode);
  });

  return {
    button,
    setMode
  };
}
