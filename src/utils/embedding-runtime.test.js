import { createEmbeddingRuntime } from './embedding-runtime.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createJsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json() {
      return Promise.resolve(body);
    }
  };
}

export async function runEmbeddingRuntimeTests() {
  const events = [];
  const runtime = createEmbeddingRuntime({
    fetchImpl() {
      return Promise.resolve(createJsonResponse({
        data: [
          {
            embedding: [0.1, 0.2, 0.3]
          }
        ],
        usage: {
          prompt_tokens: 3,
          total_tokens: 3
        },
        model: 'text-embedding-3-small'
      }));
    }
  });

  runtime.onEvent((event) => {
    events.push(event);
  });

  const success = await runtime.requestEmbeddings('Venice', {
    providerId: 'openai',
    modelId: 'text-embedding-3-small',
    apiKey: 'test-key'
  });
  const invalid = await runtime.requestEmbeddings('', {
    providerId: '',
    modelId: ''
  });
  const unsupported = await runtime.requestEmbeddings('Venice', {
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    apiKey: 'test-key'
  });

  const failingRuntime = createEmbeddingRuntime({
    fetchImpl() {
      return Promise.resolve(createJsonResponse({ error: 'failed' }, false, 500));
    }
  });
  const failed = await failingRuntime.requestEmbeddings('Venice', {
    providerId: 'openai',
    modelId: 'text-embedding-3-small',
    apiKey: 'test-key'
  });

  const diagnostics = runtime.getDiagnostics();
  const embedding = success.embeddings[0];

  return [
    assert('embedding request validation', invalid.status === 'error' && invalid.error === 'Embedding providerId is required'),
    assert('normalized embedding shape', embedding.providerId === 'openai' && embedding.modelId === 'text-embedding-3-small' && embedding.dimensions === 3 && Array.isArray(embedding.vector)),
    assert('provider integration', diagnostics.embeddingProviders >= 2),
    assert('model registry integration', success.status === 'complete' && success.metadata.model.capabilities.embeddings),
    assert('error normalization', failed.status === 'error' && failed.error === 'openai embedding request failed with 500'),
    assert('unsupported model handling', unsupported.status === 'error' && unsupported.error === 'gpt-4o-mini does not support embeddings'),
    assert('lifecycle events', events.some((event) => event.phase === 'completed'))
  ];
}
