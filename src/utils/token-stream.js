import { createLocalLlm } from './local-llm.js';
import { createRippleEmitter } from './ripple-emitter.js';
import { REQUEST_STATES } from './request-state.js';

// Bridges the local LLM transport to UI-facing stream events.
export function createTokenStream(rippleTarget) {
  const rippleEmitter = createRippleEmitter(rippleTarget || document);
  const localLlm = createLocalLlm();
  let handlers = {};
  let tokenCount = 0;
  let startedAt = 0;

  function getDuration() {
    if (!startedAt) {
      return 0;
    }

    return performance.now() - startedAt;
  }

  function emitTokenRipple() {
    const box = rippleTarget?.getBoundingClientRect?.();

    if (!box) {
      rippleEmitter.emit(window.innerWidth * 0.5, window.innerHeight * 0.5, 0.35);
      return;
    }

    rippleEmitter.emit(
      box.left + box.width * 0.5,
      box.top + box.height * 0.55,
      0.35
    );
  }

  localLlm.onToken((token) => {
    tokenCount += 1;
    handlers.onToken?.(token);
    handlers.onMetrics?.({
      tokenCount,
      duration: getDuration()
    });
    emitTokenRipple();
  });

  localLlm.onStatus((status) => {
    const streamStatus = {
      ...status,
      tokenCount,
      duration: getDuration()
    };

    handlers.onStatus?.(streamStatus);

    if (status.state === REQUEST_STATES.complete) {
      handlers.onDone?.(streamStatus);
    }

    if (status.state === REQUEST_STATES.stopped) {
      handlers.onStop?.(streamStatus);
    }

    if (status.state === REQUEST_STATES.error) {
      handlers.onError?.(streamStatus);
    }
  });

  function start(prompt, nextHandlers = {}) {
    handlers = nextHandlers;
    tokenCount = 0;
    startedAt = performance.now();
    handlers.onStart?.();
    return localLlm.sendPrompt(prompt);
  }

  function stop() {
    return localLlm.stopGeneration();
  }

  return {
    start,
    stop
  };
}
