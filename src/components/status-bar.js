// Owns the compact generation status label.
export function initStatusBar(element) {
  if (!element) {
    return null;
  }

  function setStatus(status) {
    element.textContent = status;
    element.dataset.status = status.toLowerCase();
  }

  setStatus(element.textContent || 'Idle');

  return {
    element,
    setStatus
  };
}
