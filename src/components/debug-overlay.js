const LABELS = {
  provider: 'Provider',
  providerType: 'Type',
  model: 'Model',
  state: 'State',
  tokenCount: 'Tokens',
  duration: 'Duration',
  fps: 'FPS',
  rippleCount: 'Ripples',
  visualMode: 'Mode',
  endpointHost: 'Endpoint'
};

const DEFAULT_STATE = {
  provider: 'None',
  providerType: 'local',
  model: '',
  state: 'idle',
  tokenCount: 0,
  duration: '0.0s',
  fps: 0,
  rippleCount: 0,
  visualMode: 'silver',
  endpointHost: 'Not connected'
};

// Owns the read-only developer overlay display.
export function initDebugOverlay() {
  const element = document.createElement('aside');
  const values = {};

  element.className = 'debug-overlay';
  element.dataset.visible = 'false';
  element.setAttribute('aria-hidden', 'true');

  const title = document.createElement('div');
  title.className = 'debug-overlay__title';
  title.textContent = 'Venice Dev';
  element.appendChild(title);

  Object.entries(LABELS).forEach(([key, label]) => {
    const row = document.createElement('div');
    const labelElement = document.createElement('span');
    const valueElement = document.createElement('span');

    row.className = 'debug-overlay__row';
    labelElement.textContent = label;
    valueElement.textContent = DEFAULT_STATE[key];
    values[key] = valueElement;

    row.append(labelElement, valueElement);
    element.appendChild(row);
  });

  document.body.appendChild(element);

  function setVisible(isVisible) {
    element.dataset.visible = String(isVisible);
    element.setAttribute('aria-hidden', String(!isVisible));
  }

  function toggle() {
    setVisible(element.dataset.visible !== 'true');
  }

  function update(nextState) {
    Object.entries(nextState).forEach(([key, value]) => {
      if (values[key]) {
        values[key].textContent = value;
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== '`' || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    event.preventDefault();
    toggle();
  });

  update(DEFAULT_STATE);

  return {
    element,
    update,
    setVisible,
    toggle
  };
}
