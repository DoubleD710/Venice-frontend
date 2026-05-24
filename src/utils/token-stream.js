import { sendCloudPrompt } from './cloud-llm.js';
import { createLocalLlm } from './local-llm.js';
import { getDefaultProvider, getProvider, isCloudProvider } from './provider-registry.js';
import { getProviderCredential, loadProviderSettings } from './provider-settings.js';
import { createRippleEmitter } from './ripple-emitter.js';
import { REQUEST_STATES } from './request-state.js';

function getRuntimeProviderSettings() {
  const settings = loadProviderSettings();
  const provider = getProvider(settings.selectedProvider) || getDefaultProvider();

  return {
    provider,
    model: settings.models[provider.id] || provider.defaultModel,
    endpoint: settings.endpoints[provider.id] || provider.defaultEndpoint,
    apiKey: getProviderCredential(provider.id)
  };
}

// Bridges provider transports to UI-facing stream events.
export function createTokenStream(rippleTarget) {
  const rippleEmitter = createRippleEmitter(rippleTarget || document);
  const localLlm = createLocalLlm();
  let handlers = {};
  let tokenCount = 0;
  let startedAt = 0;
  let activeRequestId = 0;
  let cloudAbortController = null;
  let activeRuntime = null;

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

  function withMetrics(status) {
    return {
      ...status,
      tokenCount,
      duration: getDuration()
    };
  }

  function handleToken(token) {
    tokenCount += 1;
    handlers.onToken?.(token);
    handlers.onMetrics?.({
      tokenCount,
      duration: getDuration()
    });
    emitTokenRipple();
  }

  function handleStatus(status) {
    const streamStatus = withMetrics(status);

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
  }

  function handleToolCall(toolCall) {
    handlers.onToolCall?.(toolCall);
  }

  function handleProviderEvent(event, runtime) {
    if (event.type === 'token') {
      handleToken(event.text);
      return;
    }

    if (event.type === 'tool_call') {
      handleToolCall(event.toolCall);
      return;
    }

    if (event.type === 'status') {
      handleStatus(event);
      return;
    }

    if (event.type === 'complete') {
      handleStatus({
        state: REQUEST_STATES.complete,
        message: 'Complete',
        provider: runtime.provider.label,
        providerId: runtime.provider.id,
        providerType: runtime.provider.type,
        endpointUrl: runtime.endpoint,
        model: runtime.model,
        usage: event.usage
      });
      return;
    }

    if (event.type === 'error') {
      if (event.error === 'Stopped') {
        handleStatus({
          state: REQUEST_STATES.stopped,
          message: 'Stopped',
          provider: runtime.provider.label,
          providerId: runtime.provider.id,
          providerType: runtime.provider.type,
          endpointUrl: runtime.endpoint,
          model: runtime.model
        });
        return;
      }

      handleStatus({
        state: REQUEST_STATES.error,
        message: event.error,
        provider: runtime.provider.label,
        providerId: runtime.provider.id,
        providerType: runtime.provider.type,
        endpointUrl: runtime.endpoint,
        model: runtime.model
      });
    }
  }

  localLlm.onToken(handleToken);
  localLlm.onStatus(handleStatus);
  localLlm.onToolCall(handleToolCall);

  async function startCloud(prompt, runtime, requestId) {
    cloudAbortController = new AbortController();

    try {
      for await (const event of sendCloudPrompt({
        providerId: runtime.provider.id,
        prompt,
        model: runtime.model,
        endpoint: runtime.endpoint,
        apiKey: runtime.apiKey,
        signal: cloudAbortController.signal
      })) {
        if (requestId !== activeRequestId) {
          return;
        }

        handleProviderEvent(event, runtime);
      }
    } finally {
      if (requestId === activeRequestId) {
        cloudAbortController = null;
        activeRuntime = null;
      }
    }
  }

  function emitStoppedForRuntime(runtime) {
    if (!runtime) {
      return;
    }

    handleStatus({
      state: REQUEST_STATES.stopped,
      message: 'Stopped',
      provider: runtime.provider.label,
      providerId: runtime.provider.id,
      providerType: runtime.provider.type,
      endpointUrl: runtime.endpoint,
      model: runtime.model
    });
  }

  function start(prompt, nextHandlers = {}) {
    handlers = nextHandlers;
    tokenCount = 0;
    startedAt = performance.now();
    activeRequestId += 1;
    handlers.onStart?.();

    const requestId = activeRequestId;
    const runtime = getRuntimeProviderSettings();
    activeRuntime = runtime;

    if (isCloudProvider(runtime.provider.id)) {
      return startCloud(prompt, runtime, requestId);
    }

    return localLlm.sendPrompt(prompt, {
      providerId: runtime.provider.id,
      model: runtime.model,
      endpoint: runtime.endpoint
    });
  }

  function stop() {
    activeRequestId += 1;

    if (cloudAbortController) {
      cloudAbortController.abort();
      cloudAbortController = null;
      emitStoppedForRuntime(activeRuntime);
      activeRuntime = null;
      return;
    }

    activeRuntime = null;
    return localLlm.stopGeneration();
  }

  return {
    start,
    stop
  };
}
