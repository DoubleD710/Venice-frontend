export function createStreamDiagnostics() {
  const startedAt = performance.now();
  let completedAt = 0;
  let firstTokenAt = 0;
  let chunkCount = 0;
  let byteCount = 0;
  let tokenCount = 0;
  let toolCallCount = 0;
  let errorCount = 0;
  let malformedChunkCount = 0;

  function getByteLength(rawChunk) {
    if (!rawChunk) {
      return 0;
    }

    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(rawChunk).length;
    }

    return String(rawChunk).length;
  }

  function getDuration() {
    return (completedAt || performance.now()) - startedAt;
  }

  function snapshot() {
    return {
      chunkCount,
      byteCount,
      tokenCount,
      toolCallCount,
      errorCount,
      malformedChunkCount,
      duration: getDuration(),
      timeToFirstToken: firstTokenAt ? firstTokenAt - startedAt : 0
    };
  }

  function recordChunk(rawChunk) {
    chunkCount += 1;
    byteCount += getByteLength(rawChunk);

    return snapshot();
  }

  function recordEvent(event) {
    if (event.type === 'token') {
      tokenCount += 1;

      if (!firstTokenAt) {
        firstTokenAt = performance.now();
      }
    }

    if (event.type === 'tool_call') {
      toolCallCount += 1;
    }

    if (event.type === 'error') {
      errorCount += 1;

      if (event.error === 'Malformed provider stream chunk') {
        malformedChunkCount += 1;
      }
    }

    if (event.type === 'complete') {
      completedAt = performance.now();
    }

    return snapshot();
  }

  return {
    recordChunk,
    recordEvent,
    snapshot
  };
}
