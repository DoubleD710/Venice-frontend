export const EMBEDDING_LIFECYCLE = {
  requested: 'requested',
  validated: 'validated',
  started: 'started',
  completed: 'completed',
  error: 'error'
};

export const EMBEDDING_STATUS = {
  pending: 'pending',
  complete: 'complete',
  error: 'error'
};

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function normalizeInput(input) {
  return Array.isArray(input) ? input : [input];
}

export function createEmbeddingRequest({
  id = createId('embedding'),
  providerId = '',
  modelId = '',
  input = [],
  modality = 'text',
  endpoint = '',
  apiKey = '',
  metadata = {}
} = {}) {
  return {
    id,
    providerId,
    modelId,
    input: normalizeInput(input).filter((value) => value !== undefined && value !== null),
    modality,
    endpoint,
    apiKey,
    metadata
  };
}

export function validateEmbeddingRequest(request) {
  const errors = [];

  if (!request?.id) {
    errors.push('Embedding request id is required');
  }

  if (!request?.providerId) {
    errors.push('Embedding providerId is required');
  }

  if (!request?.modelId) {
    errors.push('Embedding modelId is required');
  }

  if (!Array.isArray(request?.input) || request.input.length === 0) {
    errors.push('Embedding input is required');
  }

  if (!request?.modality) {
    errors.push('Embedding modality is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function normalizeEmbeddingVector(vector) {
  if (!Array.isArray(vector)) {
    return [];
  }

  return vector
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

export function createEmbedding({
  providerId,
  modelId,
  vector,
  modality = 'text',
  metadata = {},
  status = EMBEDDING_STATUS.complete
} = {}) {
  const normalizedVector = normalizeEmbeddingVector(vector);

  return {
    providerId,
    modelId,
    dimensions: normalizedVector.length,
    modality,
    vector: normalizedVector,
    metadata,
    status
  };
}

export function createEmbeddingEvent(phase, request, detail = {}) {
  return {
    type: 'embedding_event',
    phase,
    requestId: request.id,
    providerId: request.providerId,
    modelId: request.modelId,
    timestamp: new Date().toISOString(),
    ...detail
  };
}

export function createEmbeddingError(request, message, metadata = {}) {
  return {
    type: 'embedding_result',
    status: EMBEDDING_STATUS.error,
    requestId: request?.id || '',
    providerId: request?.providerId || '',
    modelId: request?.modelId || '',
    embeddings: [],
    error: message,
    metadata
  };
}

export function createEmbeddingResult(request, embeddings, metadata = {}) {
  return {
    type: 'embedding_result',
    status: EMBEDDING_STATUS.complete,
    requestId: request.id,
    providerId: request.providerId,
    modelId: request.modelId,
    embeddings,
    error: '',
    metadata
  };
}
