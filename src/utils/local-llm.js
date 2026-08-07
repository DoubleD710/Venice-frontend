import { getDefaultProvider, getProvider } from './provider-registry.js';
import { createRequestState, REQUEST_STATES } from './request-state.js';
import { createStreamNormalizer } from './stream-normalizer.js';
import { createStreamDiagnostics } from './stream-diagnostics.js';

function createRequestBody(provider, prompt, model) {
  if (provider.id === 'ollama') {
    return {
      model,
      prompt,
      stream: true
    };
  }

  return {
    prompt,
    stream: true,
    n_predict: 512
  };
}

function getLocalProvider(providerId) {
  const provider = getProvider(providerId) || getDefaultProvider();

  return provider.type === 'local' ? provider : getDefaultProvider();
}

// Isolates local fetch streaming from the UI.
export function createLocalLlm() {
  const tokenListeners = new Set();
  const statusListeners = new Set();
  const toolCallListeners = new Set();
  const diagnosticsListeners = new Set();
  const requestState = createRequestState();
  let abortController = null;
  let activeRequestId = 0;
  let currentEndpoint = null;

  function emitStatus(state, message = '', requestId = activeRequestId, provider = null, endpointUrl = '', model = '') {
    if (requestId !== activeRequestId) {
      return;
    }

    const activeProvider = provider || getDefaultProvider();
    const status = {
      type: 'status',
      state,
      message,
      provider: activeProvider.label,
      providerId: activeProvider.id,
      providerType: activeProvider.type,
      endpointUrl,
      model
    };

    requestState.setState(state, message);
    statusListeners.forEach((listener) => listener(status));
  }

  function emitToken(token, requestId = activeRequestId) {
    if (!token || requestId !== activeRequestId) {
      return;
    }

    tokenListeners.forEach((listener) => listener(token));
  }

  function emitToolCall(toolCall, requestId = activeRequestId) {
    if (!toolCall || requestId !== activeRequestId) {
      return;
    }

    toolCallListeners.forEach((listener) => listener(toolCall));
  }

  function emitDiagnostics(diagnostics, requestId = activeRequestId) {
    if (requestId !== activeRequestId) {
      return;
    }

    diagnosticsListeners.forEach((listener) => listener(diagnostics));
  }

  function abortActiveRequest() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  async function readResponseStream(response, provider, requestId) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const normalizer = createStreamNormalizer(provider.id);
    const diagnostics = createStreamDiagnostics();

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      const rawChunk = decoder.decode(value, { stream: true });
      emitDiagnostics(diagnostics.recordChunk(rawChunk), requestId);

      const events = normalizer.push(rawChunk);

      for (const event of events) {
        emitDiagnostics(diagnostics.recordEvent(event), requestId);

        if (event.type === 'token') {
          emitToken(event.text, requestId);
        }

        if (event.type === 'tool_call') {
          emitToolCall(event.toolCall, requestId);
        }

        if (event.type === 'error') {
          throw new Error(event.error);
        }

        if (event.type === 'complete') {
          return event.usage;
        }
      }
    }

    for (const event of normalizer.flush()) {
      emitDiagnostics(diagnostics.recordEvent(event), requestId);

      if (event.type === 'token') {
        emitToken(event.text, requestId);
      }

      if (event.type === 'tool_call') {
        emitToolCall(event.toolCall, requestId);
      }

      if (event.type === 'error') {
        throw new Error(event.error);
      }
    }

    return null;
  }

  async function sendPrompt(prompt, options = {}) {
    abortActiveRequest();

    activeRequestId += 1;
    const requestId = activeRequestId;
    const provider = getLocalProvider(options.providerId);
    const model = options.model || provider.defaultModel;
    const endpointUrl = options.endpoint || provider.defaultEndpoint;
    const controller = new AbortController();
    abortController = controller;
    currentEndpoint = { provider, endpointUrl, model };

    try {
      emitStatus(REQUEST_STATES.streaming, `Connecting to ${provider.label}`, requestId, provider, endpointUrl, model);

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createRequestBody(provider, prompt, model)),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`${provider.label} returned ${response.status}`);
      }

      emitStatus(REQUEST_STATES.streaming, `Streaming from ${provider.label}`, requestId, provider, endpointUrl, model);
      const usage = await readResponseStream(response, provider, requestId);

      if (requestId === activeRequestId) {
        abortController = null;
        currentEndpoint = null;
      }

      emitStatus(REQUEST_STATES.complete, 'Complete', requestId, provider, endpointUrl, model);
      return usage;
    } catch (error) {
      if (error.name === 'AbortError') {
        emitStatus(REQUEST_STATES.stopped, 'Stopped', requestId, provider, endpointUrl, model);
        return null;
      }

      if (requestId === activeRequestId) {
        abortController = null;
        currentEndpoint = null;
      }

      emitStatus(REQUEST_STATES.error, error.message, requestId, provider, endpointUrl, model);
      return null;
    }
  }

  function stopGeneration(emitStopped = true) {
    const requestId = activeRequestId;
    const stoppedEndpoint = currentEndpoint;
    abortActiveRequest();

    if (emitStopped) {
      emitStatus(
        REQUEST_STATES.stopped,
        'Stopped',
        requestId,
        stoppedEndpoint?.provider,
        stoppedEndpoint?.endpointUrl,
        stoppedEndpoint?.model
      );
    }

    currentEndpoint = null;
    activeRequestId += 1;
  }

  function onToken(callback) {
    tokenListeners.add(callback);

    return () => {
      tokenListeners.delete(callback);
    };
  }

  function onStatus(callback) {
    statusListeners.add(callback);

    return () => {
      statusListeners.delete(callback);
    };
  }

  function onToolCall(callback) {
    toolCallListeners.add(callback);

    return () => {
      toolCallListeners.delete(callback);
    };
  }

  function onDiagnostics(callback) {
    diagnosticsListeners.add(callback);

    return () => {
      diagnosticsListeners.delete(callback);
    };
  }

  return {
    sendPrompt,
    stopGeneration,
    onToken,
    onStatus,
    onToolCall,
    onDiagnostics
  };
}

const localLlm = createLocalLlm();

export const sendPrompt = localLlm.sendPrompt;
export const stopGeneration = localLlm.stopGeneration;
export const onToken = localLlm.onToken;
export const onStatus = localLlm.onStatus;
export const onToolCall = localLlm.onToolCall;
export const onDiagnostics = localLlm.onDiagnostics;
