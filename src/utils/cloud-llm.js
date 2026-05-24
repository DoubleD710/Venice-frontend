import { getProvider, isCloudProvider } from './provider-registry.js';
import { createStreamNormalizer } from './stream-normalizer.js';
import { createStreamDiagnostics } from './stream-diagnostics.js';

function buildMessages(prompt, messages = []) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }

  return [
    {
      role: 'user',
      content: prompt
    }
  ];
}

export function buildCloudRequestPayload({ prompt, messages, model }) {
  return {
    model,
    messages: buildMessages(prompt, messages),
    stream: true
  };
}

export async function* normalizeCloudStream(providerId, response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const normalizer = createStreamNormalizer(providerId);
  const diagnostics = createStreamDiagnostics();

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      yield {
        type: 'diagnostic',
        diagnostics: diagnostics.recordChunk(chunk)
      };

      for (const event of normalizer.push(chunk)) {
        yield {
          type: 'diagnostic',
          diagnostics: diagnostics.recordEvent(event)
        };
        yield event;
      }
    }

    for (const event of normalizer.flush()) {
      yield {
        type: 'diagnostic',
        diagnostics: diagnostics.recordEvent(event)
      };
      yield event;
    }
  } catch (error) {
    const event = {
      type: 'error',
      error: error.name === 'AbortError' ? 'Stopped' : error.message
    };

    yield {
      type: 'diagnostic',
      diagnostics: diagnostics.recordEvent(event)
    };
    yield event;
  }
}

export async function* sendCloudPrompt({
  providerId,
  prompt,
  messages = [],
  model,
  endpoint,
  apiKey,
  signal
}) {
  const provider = getProvider(providerId);

  if (!provider || !isCloudProvider(providerId)) {
    yield { type: 'error', error: 'Cloud provider is not configured' };
    return;
  }

  if (!apiKey) {
    yield { type: 'error', error: `${provider.label} API key is missing` };
    return;
  }

  const activeModel = model || provider.defaultModel;
  const activeEndpoint = endpoint || provider.defaultEndpoint;

  yield {
    type: 'status',
    state: 'streaming',
    provider: provider.label,
    providerId: provider.id,
    providerType: provider.type,
    endpointUrl: activeEndpoint,
    model: activeModel,
    message: `Connecting to ${provider.label}`
  };

  try {
    const response = await fetch(activeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(buildCloudRequestPayload({
        providerId,
        prompt,
        messages,
        model: activeModel
      })),
      signal
    });

    if (!response.ok || !response.body) {
      yield { type: 'error', error: `${provider.label} returned ${response.status}` };
      return;
    }

    yield {
      type: 'status',
      state: 'streaming',
      provider: provider.label,
      providerId: provider.id,
      providerType: provider.type,
      endpointUrl: activeEndpoint,
      model: activeModel,
      message: `Streaming from ${provider.label}`
    };

    for await (const event of normalizeCloudStream(providerId, response)) {
      yield event;
    }
  } catch (error) {
    yield {
      type: error.name === 'AbortError' ? 'status' : 'error',
      state: error.name === 'AbortError' ? 'stopped' : undefined,
      provider: provider.label,
      providerId: provider.id,
      providerType: provider.type,
      endpointUrl: activeEndpoint,
      model: activeModel,
      message: error.name === 'AbortError' ? 'Stopped' : undefined,
      error: error.name === 'AbortError' ? undefined : error.message
    };
  }
}
