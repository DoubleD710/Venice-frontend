import { normalizeEmbeddingVector } from './embedding-contracts.js';

export const RECALL_LIFECYCLE = {
  requested: 'requested',
  validated: 'validated',
  ranked: 'ranked',
  selected: 'selected',
  packaged: 'packaged',
  completed: 'completed',
  error: 'error'
};

export const RECALL_STATUS = {
  complete: 'complete',
  error: 'error'
};

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

export function normalizeRecallVector(value) {
  if (Array.isArray(value)) {
    return normalizeEmbeddingVector(value);
  }

  return normalizeEmbeddingVector(value?.vector);
}

export function createRecallCandidate({
  id = '',
  content = '',
  embedding = [],
  metadata = {}
} = {}) {
  return {
    id,
    content,
    embedding: normalizeRecallVector(embedding),
    metadata
  };
}

export function createRecallScore({
  similarity = 0,
  recency = 0,
  weighted = 0,
  metadata = {}
} = {}) {
  return {
    similarity,
    recency,
    weighted,
    metadata
  };
}

export function createRecallRequest({
  id = createId('recall'),
  queryEmbedding = [],
  candidates = [],
  topK = 5,
  rankingStrategy = 'weighted',
  rankingWeights = {},
  metadata = {}
} = {}) {
  return {
    id,
    queryEmbedding: normalizeRecallVector(queryEmbedding),
    candidates: candidates.map(createRecallCandidate),
    topK,
    rankingStrategy,
    rankingWeights: {
      similarity: 0.8,
      recency: 0.2,
      ...rankingWeights
    },
    metadata
  };
}

export function validateRecallRequest(request) {
  const errors = [];

  if (!request?.id) {
    errors.push('Recall request id is required');
  }

  if (!Array.isArray(request?.queryEmbedding) || request.queryEmbedding.length === 0) {
    errors.push('Recall queryEmbedding is required');
  }

  if (!Array.isArray(request?.candidates)) {
    errors.push('Recall candidates must be an array');
  }

  if (!Number.isInteger(request?.topK) || request.topK < 1) {
    errors.push('Recall topK must be a positive integer');
  }

  if (!request?.rankingStrategy) {
    errors.push('Recall rankingStrategy is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createRecallEvent(phase, request, detail = {}) {
  return {
    type: 'recall_event',
    phase,
    requestId: request?.id || '',
    timestamp: new Date().toISOString(),
    ...detail
  };
}

export function createRecallError(request, message, metadata = {}) {
  return {
    type: 'recall_result',
    status: RECALL_STATUS.error,
    requestId: request?.id || '',
    results: [],
    contextPackage: null,
    error: message,
    metadata
  };
}
