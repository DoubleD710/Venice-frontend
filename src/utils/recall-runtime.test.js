import { createEmbedding } from './embedding-contracts.js';
import { createRecallRuntime } from './recall-runtime.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createCandidates() {
  return [
    {
      id: 'alpha',
      content: 'Closest match',
      embedding: [1, 0, 0],
      metadata: {
        createdAt: '2026-06-10T00:00:00.000Z'
      }
    },
    {
      id: 'beta',
      content: 'Weaker match',
      embedding: [0.2, 0.8, 0],
      metadata: {
        createdAt: '2026-06-11T00:00:00.000Z'
      }
    },
    {
      id: 'gamma',
      content: 'Opposite match',
      embedding: [-1, 0, 0],
      metadata: {
        createdAt: '2026-06-11T00:00:00.000Z'
      }
    }
  ];
}

export function runRecallRuntimeTests() {
  const events = [];
  const runtime = createRecallRuntime({
    nowProvider() {
      return Date.parse('2026-06-11T00:00:00.000Z');
    }
  });

  runtime.onEvent((event) => {
    events.push(event);
  });

  const invalid = runtime.recall({
    queryEmbedding: [],
    candidates: createCandidates()
  });
  const ranked = runtime.recall({
    id: 'recall-test',
    queryEmbedding: [1, 0, 0],
    candidates: createCandidates(),
    topK: 2,
    rankingStrategy: 'similarity'
  });
  const weighted = runtime.recall({
    id: 'weighted-test',
    queryEmbedding: [1, 0, 0],
    candidates: createCandidates(),
    topK: 1,
    rankingStrategy: 'weighted',
    rankingWeights: {
      similarity: 0.9,
      recency: 0.1
    }
  });
  const unknownStrategy = runtime.recall({
    id: 'unknown-strategy-test',
    queryEmbedding: [1, 0, 0],
    candidates: createCandidates(),
    rankingStrategy: 'missing'
  });
  const embeddingResult = {
    embeddings: [
      createEmbedding({
        providerId: 'openai',
        modelId: 'text-embedding-3-small',
        vector: [1, 0, 0]
      })
    ]
  };
  const fromEmbedding = runtime.recallFromEmbeddingResult(embeddingResult, {
    id: 'embedding-integration-test',
    candidates: createCandidates(),
    topK: 1,
    rankingStrategy: 'similarity'
  });

  return [
    assert('recall request validation', invalid.status === 'error' && invalid.error === 'Recall queryEmbedding is required'),
    assert('candidate ranking', ranked.results[0].candidate.id === 'alpha'),
    assert('top-k selection', ranked.results.length === 2 && ranked.results[1].rank === 2),
    assert('context package generation', ranked.contextPackage.items.length === 2 && ranked.contextPackage.items[0].content === 'Closest match'),
    assert('error normalization', unknownStrategy.status === 'error' && unknownStrategy.error === 'Unknown recall ranking strategy: missing'),
    assert('embedding-runtime integration', fromEmbedding.results[0].candidate.id === 'alpha'),
    assert('weighted score strategy', weighted.results[0].score.metadata.similarityWeight === 0.9),
    assert('lifecycle events', events.some((event) => event.phase === 'completed'))
  ];
}
