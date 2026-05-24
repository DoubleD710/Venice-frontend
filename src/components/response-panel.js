import { initStatusBar } from './status-bar.js';

// Owns response text rendering and stop-generation UI state.
export function initResponsePanel(element) {
  if (!element) {
    return null;
  }

  const output = element.querySelector('[data-response-output]');
  const stopButton = element.querySelector('[data-stop-generation]');
  const statusBar = initStatusBar(element.querySelector('[data-status-bar]'));
  let isStreaming = false;
  let scrollFrame = 0;

  function scrollToLatest() {
    if (!output) {
      return;
    }

    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      output.scrollTo({
        top: output.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  function setStatus(status) {
    statusBar?.setStatus(status);
  }

  function setStreaming(nextIsStreaming) {
    isStreaming = nextIsStreaming;
    element.dataset.streaming = String(isStreaming);

    if (stopButton) {
      stopButton.disabled = !isStreaming;
    }
  }

  function open() {
    element.dataset.visible = 'true';
  }

  function clear() {
    if (output) {
      output.textContent = '';
    }
  }

  function appendToken(token) {
    if (!output) {
      return;
    }

    output.textContent += token;
    scrollToLatest();
  }

  stopButton?.addEventListener('click', () => {
    element.dispatchEvent(new CustomEvent('venice:stop-generation', {
      bubbles: true
    }));
  });

  setStreaming(false);

  return {
    element,
    open,
    clear,
    setStatus,
    setStreaming,
    appendToken
  };
}
