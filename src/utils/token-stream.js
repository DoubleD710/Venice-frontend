import { createRippleEmitter } from './ripple-emitter.js';

// Simulates response token flow until llama.cpp fetch streaming is wired in.
export function createTokenStream(rippleTarget) {
  const rippleEmitter = createRippleEmitter(rippleTarget || document);
  let timer = 0;
  let isStreaming = false;

  function buildReply(prompt) {
    return [
      'I hear the shape of the request: ',
      prompt,
      '. ',
      'For now this is a local simulated stream, ',
      'paced like a model response and ready for a future llama.cpp fetch source.'
    ];
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

  function stop(onStop) {
    if (!isStreaming) {
      return;
    }

    window.clearTimeout(timer);
    isStreaming = false;
    onStop?.();
  }

  function start(prompt, handlers = {}) {
    stop();

    const tokens = buildReply(prompt);
    let index = 0;
    isStreaming = true;
    handlers.onStart?.();

    function streamNext() {
      if (!isStreaming) {
        return;
      }

      if (index >= tokens.length) {
        isStreaming = false;
        handlers.onDone?.();
        return;
      }

      handlers.onToken?.(tokens[index]);
      emitTokenRipple();
      index += 1;
      timer = window.setTimeout(streamNext, 170);
    }

    streamNext();
  }

  return {
    start,
    stop
  };
}
