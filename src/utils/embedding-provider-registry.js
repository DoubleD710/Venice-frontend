function getJsonHeaders(apiKey = '') {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function createOpenAiEmbeddingProvider() {
  return {
    id: 'openai',
    providerId: 'openai',
    label: 'OpenAI Embeddings',
    defaultEndpoint: 'https://api.openai.com/v1/embeddings',
    buildRequest({ input, modelId, apiKey }) {
      return {
        method: 'POST',
        headers: getJsonHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          input
        })
      };
    },
    extractVectors(responseJson) {
      return Array.isArray(responseJson?.data)
        ? responseJson.data.map((item) => item.embedding)
        : [];
    },
    getMetadata(responseJson) {
      return {
        usage: responseJson?.usage || null,
        rawModel: responseJson?.model || ''
      };
    }
  };
}

function createOllamaEmbeddingProvider() {
  return {
    id: 'ollama',
    providerId: 'ollama',
    label: 'Ollama Embeddings',
    defaultEndpoint: 'http://localhost:11434/api/embed',
    buildRequest({ input, modelId }) {
      return {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          model: modelId,
          input
        })
      };
    },
    extractVectors(responseJson) {
      if (Array.isArray(responseJson?.embeddings)) {
        return responseJson.embeddings;
      }

      return Array.isArray(responseJson?.embedding)
        ? [responseJson.embedding]
        : [];
    },
    getMetadata(responseJson) {
      return {
        promptEvalCount: responseJson?.prompt_eval_count ?? null,
        rawModel: responseJson?.model || ''
      };
    }
  };
}

export function createEmbeddingProviderRegistry(initialProviders = [
  createOpenAiEmbeddingProvider(),
  createOllamaEmbeddingProvider()
]) {
  const providers = new Map();

  function registerEmbeddingProvider(provider) {
    const errors = [];

    if (!provider?.id) {
      errors.push('Embedding provider id is required');
    }

    if (!provider?.providerId) {
      errors.push('Embedding provider providerId is required');
    }

    if (typeof provider?.buildRequest !== 'function') {
      errors.push('Embedding provider buildRequest function is required');
    }

    if (typeof provider?.extractVectors !== 'function') {
      errors.push('Embedding provider extractVectors function is required');
    }

    if (errors.length > 0) {
      return {
        ok: false,
        errors
      };
    }

    providers.set(provider.providerId, provider);

    return {
      ok: true,
      errors: []
    };
  }

  function getEmbeddingProvider(providerId) {
    return providers.get(providerId) || null;
  }

  function listEmbeddingProviders() {
    return Array.from(providers.values()).map((provider) => ({
      id: provider.id,
      providerId: provider.providerId,
      label: provider.label,
      defaultEndpoint: provider.defaultEndpoint
    }));
  }

  initialProviders.forEach((provider) => {
    registerEmbeddingProvider(provider);
  });

  return {
    registerEmbeddingProvider,
    getEmbeddingProvider,
    listEmbeddingProviders
  };
}

const defaultEmbeddingProviderRegistry = createEmbeddingProviderRegistry();

export function registerEmbeddingProvider(provider) {
  return defaultEmbeddingProviderRegistry.registerEmbeddingProvider(provider);
}

export function getEmbeddingProvider(providerId) {
  return defaultEmbeddingProviderRegistry.getEmbeddingProvider(providerId);
}

export function listEmbeddingProviders() {
  return defaultEmbeddingProviderRegistry.listEmbeddingProviders();
}
