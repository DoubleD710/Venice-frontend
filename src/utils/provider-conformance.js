import { sendCloudPrompt } from './cloud-llm.js';
import { createLocalLlm } from './local-llm.js';
import { negotiateProviderCapabilities } from './provider-capabilities.js';
import { getProvider } from './provider-registry.js';
import { normalizeStreamChunk } from './stream-normalizer.js';

const CLOUD_PROVIDERS = ['openai', 'xai', 'deepseek'];
const TARGET_PROVIDERS = [...CLOUD_PROVIDERS, 'ollama'];

function createResult(name, passed, details = '') {
  return {
    name,
    passed: Boolean(passed),
    details
  };
}

function sameShape(events, type) {
  const matching = events.filter((event) => event.type === type);
  const shapes = matching.map((event) => Object.keys(event).sort().join('|'));

  return shapes.length > 0 && new Set(shapes).size === 1;
}

function getCompleteUsageShape(events) {
  return events
    .filter((event) => event.type === 'complete')
    .map((event) => Object.keys(event.usage || {}).sort().join('|'));
}

function openAiCompatibleFixture(providerId) {
  return [
    `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          delta: {
            content: 'Hello'
          }
        }
      ]
    })}\n\n`,
    `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                id: `${providerId}-call-1`,
                type: 'function',
                function: {
                  name: 'calculator',
                  arguments: '{"expression":"2+2"}'
                }
              }
            ]
          }
        }
      ]
    })}\n\n`,
    `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 1,
        total_tokens: 4
      }
    })}\n\n`,
    'data: [DONE]\n\n'
  ].flatMap((chunk) => normalizeStreamChunk(providerId, chunk));
}

function ollamaFixture() {
  return [
    `${JSON.stringify({ response: 'Hello', done: false })}\n`,
    `${JSON.stringify({
      response: '',
      done: true,
      prompt_eval_count: 3,
      eval_count: 1
    })}\n`
  ].flatMap((chunk) => normalizeStreamChunk('ollama', chunk));
}

function providerEvents(providerId) {
  if (providerId === 'ollama') {
    return ollamaFixture();
  }

  return openAiCompatibleFixture(providerId);
}

function getEventShapes(events) {
  return events.map((event) => ({
    type: event.type,
    keys: Object.keys(event).sort()
  }));
}

function getErrorEvent(providerId) {
  const chunk = providerId === 'ollama'
    ? `${JSON.stringify({ error: 'Provider failed' })}\n`
    : `data: ${JSON.stringify({ error: { message: 'Provider failed' } })}\n\n`;

  return normalizeStreamChunk(providerId, chunk)[0];
}

function getToolEvents(providerId) {
  return providerEvents(providerId).filter((event) => event.type === 'tool_call');
}

function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';

  return error;
}

async function withMockedFetch(mockFetch, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function getCloudAbortStatuses(providerId) {
  const provider = getProvider(providerId);

  return withMockedFetch(
    () => Promise.reject(createAbortError()),
    async () => {
      const events = [];

      for await (const event of sendCloudPrompt({
        providerId,
        prompt: 'stop',
        model: provider.defaultModel,
        endpoint: provider.defaultEndpoint,
        apiKey: 'test-key',
        signal: new AbortController().signal
      })) {
        events.push(event);
      }

      return events.filter((event) => event.type === 'status');
    }
  );
}

async function getOllamaAbortStatuses() {
  const localLlm = createLocalLlm();
  const statuses = [];
  const provider = getProvider('ollama');

  localLlm.onStatus((status) => {
    statuses.push(status);
  });

  await withMockedFetch(
    () => Promise.reject(createAbortError()),
    () => localLlm.sendPrompt('stop', {
      providerId: 'ollama',
      model: provider.defaultModel,
      endpoint: provider.defaultEndpoint
    })
  );

  return statuses;
}

function testStreamShapes() {
  const eventsByProvider = TARGET_PROVIDERS.map((providerId) => providerEvents(providerId));
  const tokenShapeOk = eventsByProvider.every((events) => sameShape(events, 'token'));
  const completeShapeOk = eventsByProvider.every((events) => sameShape(events, 'complete'));
  const usageShapes = eventsByProvider.flatMap(getCompleteUsageShape);

  return [
    createResult('normalized token event shape', tokenShapeOk),
    createResult('normalized completion event shape', completeShapeOk),
    createResult('normalized usage metadata shape', new Set(usageShapes).size === 1)
  ];
}

function testErrorShapes() {
  const errors = TARGET_PROVIDERS.map(getErrorEvent);
  const shapes = errors.map((event) => Object.keys(event || {}).sort().join('|'));

  return [
    createResult('normalized error event shape', new Set(shapes).size === 1),
    createResult('normalized error message', errors.every((event) => event.error === 'Provider failed'))
  ];
}

function testToolCallShapes() {
  const cloudToolEvents = CLOUD_PROVIDERS.flatMap(getToolEvents);
  const toolShapes = cloudToolEvents.map((event) => Object.keys(event.toolCall || {}).sort().join('|'));
  const ollamaToolEvents = getToolEvents('ollama');

  return [
    createResult('normalized tool_call event shape', sameShape(cloudToolEvents, 'tool_call')),
    createResult('normalized toolCall payload shape', new Set(toolShapes).size === 1),
    createResult('unsupported provider emits no tool calls', ollamaToolEvents.length === 0)
  ];
}

function testCapabilityNegotiation() {
  const requested = {
    streaming: true,
    tools: true,
    json: true
  };
  const first = negotiateProviderCapabilities('openai', requested);
  const second = negotiateProviderCapabilities('openai', requested);
  const unknown = negotiateProviderCapabilities('missing-provider', requested);
  const ollama = negotiateProviderCapabilities('ollama', requested);

  return [
    createResult('capability negotiation is pure for identical input', JSON.stringify(first) === JSON.stringify(second)),
    createResult('unknown provider degrades safely', !unknown.ok && !unknown.enabled.streaming && !unknown.enabled.tools),
    createResult('unsupported tools do not enable execution', ollama.ok && !ollama.enabled.tools),
    createResult('capability negotiation keeps warnings separate from errors', ollama.warnings.length > 0 && ollama.errors.length === 0)
  ];
}

async function testAbortBehavior() {
  const cloudStatusesByProvider = await Promise.all(CLOUD_PROVIDERS.map(getCloudAbortStatuses));
  const ollamaStatuses = await getOllamaAbortStatuses();
  const stoppedStatuses = [...cloudStatusesByProvider.flat(), ...ollamaStatuses]
    .filter((status) => status.state === 'stopped');
  const stoppedShapes = stoppedStatuses.map((status) => Object.keys(status).sort().join('|'));

  return [
    createResult('abort emits stopped status for every provider', stoppedStatuses.length === TARGET_PROVIDERS.length),
    createResult('abort stopped status shape is identical', new Set(stoppedShapes).size === 1)
  ];
}

function summarize(results) {
  return {
    passed: results.every((result) => result.passed),
    total: results.length,
    failed: results.filter((result) => !result.passed).length,
    results
  };
}

export async function runProviderConformanceTests() {
  const results = [
    ...testStreamShapes(),
    ...testErrorShapes(),
    ...testToolCallShapes(),
    ...testCapabilityNegotiation(),
    ...(await testAbortBehavior())
  ];

  return {
    providers: TARGET_PROVIDERS,
    eventShapes: Object.fromEntries(
      TARGET_PROVIDERS.map((providerId) => [providerId, getEventShapes(providerEvents(providerId))])
    ),
    ...summarize(results)
  };
}
