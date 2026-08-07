import {
  createEmbedding,
  createEmbeddingError,
  createEmbeddingEvent,
  createEmbeddingRequest,
  createEmbeddingResult,
  EMBEDDING_LIFECYCLE,
  validateEmbeddingRequest
} from './embedding-contracts.js';
import { createEmbeddingProviderRegistry } from './embedding-provider-registry.js';
import { resolveModel } from './model-resolution.js';
import { getProvider } from './provider-registry.js';

function normalizeError(error) {
  return error?.message || String(error || 'Embedding request failed');
}

function getEndpoint(adapter, request) {
  return request.endpoint || adapter.defaultEndpoint || '';
}

function validateResolvedEmbeddingRequest(request, modelResolution, adapter) {
  const errors = [];

  if (!modelResolution.ok) {
    errors.push(...modelResolution.errors);
  }

  if (!getProvider(request.providerId)) {
    errors.push('Unknown provider');
  }

  if (!modelResolution.model?.capabilities?.embeddings) {
    errors.push(`${request.modelId} does not support embeddings`);
  }

  if (!adapter) {
    errors.push(`${request.providerId} does not have an embedding transport adapter`);
  }

  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors))
  };
}

export function createEmbeddingRuntime(options = {}) {
  const providerRegistry = options.providerRegistry || createEmbeddingProviderRegistry();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const listeners = new Set();
  let requestCount = 0;
  let lastStatus = 'idle';

  function emit(event) {
    lastStatus = event.phase || lastStatus;
    listeners.forEach((listener) => listener(event));
  }

  function onEvent(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  async function requestEmbeddings(input, optionsForRequest = {}) {
    const request = createEmbeddingRequest({
      ...optionsForRequest,
      input
    });
    const requestValidation = validateEmbeddingRequest(request);

    emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.requested, request));

    if (!requestValidation.ok) {
      const result = createEmbeddingError(request, requestValidation.errors[0]);

      emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }

    const modelResolution = resolveModel(request.providerId, request.modelId);
    const adapter = providerRegistry.getEmbeddingProvider(request.providerId);
    const resolvedValidation = validateResolvedEmbeddingRequest(request, modelResolution, adapter);

    if (!resolvedValidation.ok) {
      const result = createEmbeddingError(request, resolvedValidation.errors[0], {
        modelResolution
      });

      emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }

    emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.validated, request, {
      model: modelResolution.model
    }));
    emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.started, request));

    try {
      const endpoint = getEndpoint(adapter, request);
      const response = await fetchImpl(endpoint, adapter.buildRequest({
        input: request.input,
        modelId: modelResolution.model.id,
        apiKey: request.apiKey,
        metadata: request.metadata
      }));

      if (!response?.ok) {
        throw new Error(`${request.providerId} embedding request failed with ${response?.status || 'unknown status'}`);
      }

      const responseJson = await response.json();
      const vectors = adapter.extractVectors(responseJson);
      const embeddings = vectors.map((vector) => createEmbedding({
        providerId: request.providerId,
        modelId: modelResolution.model.id,
        vector,
        modality: request.modality,
        metadata: {
          ...request.metadata,
          ...(typeof adapter.getMetadata === 'function' ? adapter.getMetadata(responseJson) : {})
        }
      }));
      const result = createEmbeddingResult(request, embeddings, {
        model: modelResolution.model,
        batchSize: embeddings.length
      });

      requestCount += 1;
      emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.completed, request, {
        dimensions: embeddings[0]?.dimensions || 0,
        batchSize: embeddings.length
      }));
      return result;
    } catch (error) {
      const result = createEmbeddingError(request, normalizeError(error), {
        model: modelResolution.model
      });

      emit(createEmbeddingEvent(EMBEDDING_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }
  }

  function getDiagnostics() {
    return {
      requestCount,
      lastStatus,
      embeddingProviders: providerRegistry.listEmbeddingProviders().length
    };
  }

  return {
    requestEmbeddings,
    onEvent,
    getDiagnostics
  };
}
