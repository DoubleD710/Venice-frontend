import { createRequestState, REQUEST_STATES } from './request-state.js';

const DEFAULT_OLLAMA_MODEL = 'llama3.2';

function getLocalSetting(name, fallback) {
  try {
    return window.localStorage.getItem(name) || fallback;
  } catch {
    return fallback;
  }
}

function createEndpoints() {
  const ollamaModel = getLocalSetting('venice:ollama-model', DEFAULT_OLLAMA_MODEL);

  return [
    {
      name: 'Ollama',
      url: getLocalSetting('venice:ollama-url', 'http://localhost:11434/api/generate'),
      body(prompt) {
        return {
          model: ollamaModel,
          prompt,
          stream: true
        };
      }
    },
    {
      name: 'llama.cpp',
      url: getLocalSetting('venice:llama-url', 'http://localhost:8080/completion'),
      body(prompt) {
        return {
          prompt,
          stream: true,
          n_predict: 512
        };
      }
    }
  ];
}

function parseStreamLine(line) {
  const text = line.trim();

  if (!text) {
    return null;
  }

  if (text.startsWith(':') || text.startsWith('event:')) {
    return null;
  }

  const payload = text.startsWith('data:') ? text.slice(5).trim() : text;

  if (!payload || payload === '[DONE]') {
    return { done: true, token: '' };
  }

  const data = JSON.parse(payload);

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    done: Boolean(data.done || data.stop || data.stopped || data.choices?.[0]?.finish_reason),
    token: data.response || data.content || data.choices?.[0]?.delta?.content || data.choices?.[0]?.text || ''
  };
}

// Isolates local fetch streaming from the UI.
export function createLocalLlm() {
  const tokenListeners = new Set();
  const statusListeners = new Set();
  const requestState = createRequestState();
  let abortController = null;
  let activeRequestId = 0;
  let currentEndpoint = null;

  function emitStatus(state, message = '', requestId = activeRequestId, endpoint = null) {
    if (requestId !== activeRequestId) {
      return;
    }

    const status = {
      state,
      message,
      provider: endpoint?.name || 'None',
      endpointUrl: endpoint?.url || 'Not connected'
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

  function abortActiveRequest() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  async function readResponseStream(response, requestId) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const chunk = parseStreamLine(line);

        if (!chunk) {
          continue;
        }

        emitToken(chunk.token, requestId);

        if (chunk.done) {
          return;
        }
      }
    }

    if (buffer.trim()) {
      const chunk = parseStreamLine(buffer);
      emitToken(chunk?.token, requestId);
    }
  }

  async function tryEndpoint(endpoint, prompt, controller, requestId) {
    currentEndpoint = endpoint;
    emitStatus(REQUEST_STATES.streaming, `Connecting to ${endpoint.name}`, requestId, endpoint);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(endpoint.body(prompt)),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`${endpoint.name} returned ${response.status}`);
    }

    emitStatus(REQUEST_STATES.streaming, `Streaming from ${endpoint.name}`, requestId, endpoint);
    await readResponseStream(response, requestId);
  }

  async function sendPrompt(prompt) {
    abortActiveRequest();

    activeRequestId += 1;
    const requestId = activeRequestId;
    const controller = new AbortController();
    abortController = controller;
    const endpoints = createEndpoints();
    let lastError = null;
    let lastEndpoint = null;

    for (const endpoint of endpoints) {
      try {
        lastEndpoint = endpoint;
        await tryEndpoint(endpoint, prompt, controller, requestId);

        if (requestId === activeRequestId) {
          abortController = null;
          currentEndpoint = null;
        }

        emitStatus(REQUEST_STATES.complete, 'Complete', requestId, endpoint);
        return;
      } catch (error) {
        if (error.name === 'AbortError') {
          emitStatus(REQUEST_STATES.stopped, 'Stopped', requestId, endpoint);
          return;
        }

        lastError = error;
      }
    }

    if (requestId === activeRequestId) {
      abortController = null;
      currentEndpoint = null;
    }

    emitStatus(
      REQUEST_STATES.error,
      `Could not reach Ollama or llama.cpp. ${lastError?.message || 'Check your local server.'}`,
      requestId,
      lastEndpoint
    );
  }

  function stopGeneration(emitStopped = true) {
    const requestId = activeRequestId;
    const stoppedEndpoint = currentEndpoint;
    abortActiveRequest();

    if (emitStopped) {
      emitStatus(REQUEST_STATES.stopped, 'Stopped', requestId, stoppedEndpoint);
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

  return {
    sendPrompt,
    stopGeneration,
    onToken,
    onStatus
  };
}

const localLlm = createLocalLlm();

export const sendPrompt = localLlm.sendPrompt;
export const stopGeneration = localLlm.stopGeneration;
export const onToken = localLlm.onToken;
export const onStatus = localLlm.onStatus;
