import { normalizeToolCalls } from './tool-call-normalizer.js';

function parseJson(payload) {
  try {
    return {
      data: JSON.parse(payload),
      error: null
    };
  } catch {
    return {
      data: null,
      error: 'Malformed provider stream chunk'
    };
  }
}

function normalizeOpenAiCompatible(providerId, data) {
  const events = [];
  const choice = data?.choices?.[0];
  const delta = choice?.delta || choice?.message || {};
  const text = delta.content || choice?.text || '';

  if (text) {
    events.push({ type: 'token', text });
  }

  normalizeToolCalls(providerId, data).forEach((toolCall) => {
    events.push({ type: 'tool_call', toolCall });
  });

  if (choice?.finish_reason || data?.usage) {
    events.push({ type: 'complete', usage: data.usage });
  }

  return events;
}

function normalizeOllama(data) {
  const events = [];

  if (data?.response) {
    events.push({ type: 'token', text: data.response });
  }

  if (data?.done) {
    events.push({
      type: 'complete',
      usage: {
        promptEvalCount: data.prompt_eval_count,
        evalCount: data.eval_count
      }
    });
  }

  return events;
}

function normalizeLlamaCpp(data) {
  const events = [];
  const text = data?.content || data?.response || data?.choices?.[0]?.text || '';

  if (text) {
    events.push({ type: 'token', text });
  }

  if (data?.stop || data?.stopped || data?.done || data?.choices?.[0]?.finish_reason) {
    events.push({ type: 'complete', usage: data.usage });
  }

  return events;
}

function normalizeData(providerId, data) {
  if (data?.error) {
    return [{ type: 'error', error: String(data.error.message || data.error) }];
  }

  if (providerId === 'ollama') {
    return normalizeOllama(data);
  }

  if (providerId === 'llamaCpp') {
    return normalizeLlamaCpp(data);
  }

  return normalizeOpenAiCompatible(providerId, data);
}

function normalizeLine(providerId, line) {
  const text = line.trim();

  if (!text || text.startsWith(':') || text.startsWith('event:')) {
    return [];
  }

  const payload = text.startsWith('data:') ? text.slice(5).trim() : text;

  if (!payload || payload === '[DONE]') {
    return [{ type: 'complete' }];
  }

  const parsed = parseJson(payload);

  if (parsed.error) {
    return [{ type: 'error', error: parsed.error }];
  }

  return normalizeData(providerId, parsed.data);
}

export function createStreamNormalizer(providerId) {
  let buffer = '';
  let hasCompleted = false;

  function dedupeComplete(events) {
    return events.filter((event) => {
      if (event.type !== 'complete') {
        return true;
      }

      if (hasCompleted) {
        return false;
      }

      hasCompleted = true;
      return true;
    });
  }

  function push(rawChunk) {
    buffer += rawChunk || '';

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    return dedupeComplete(lines.flatMap((line) => normalizeLine(providerId, line)));
  }

  function flush() {
    if (!buffer.trim()) {
      buffer = '';
      return [];
    }

    const events = dedupeComplete(normalizeLine(providerId, buffer));
    buffer = '';
    return events;
  }

  return {
    push,
    flush
  };
}

export function normalizeStreamChunk(providerId, rawChunk) {
  const normalizer = createStreamNormalizer(providerId);

  return [
    ...normalizer.push(rawChunk),
    ...normalizer.flush()
  ];
}
