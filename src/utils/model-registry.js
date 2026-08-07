import { normalizeModelMetadata, validateModelContract } from './model-contracts.js';

const DEFAULT_MODELS = [
  {
    id: 'llama3.2',
    providerId: 'ollama',
    name: 'Llama 3.2',
    capabilities: {
      streaming: true,
      tools: false,
      json: false,
      vision: false,
      embeddings: false,
      reasoning: false
    },
    contextWindow: 8192,
    pricingMetadata: {
      source: 'local'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'available'
  },
  {
    id: 'local-model',
    providerId: 'llamaCpp',
    name: 'llama.cpp Local Model',
    capabilities: {
      streaming: true,
      tools: false,
      json: false,
      vision: false,
      embeddings: false,
      reasoning: false
    },
    contextWindow: null,
    pricingMetadata: {
      source: 'local'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'available'
  },
  {
    id: 'nomic-embed-text',
    providerId: 'ollama',
    name: 'Nomic Embed Text',
    capabilities: {
      streaming: false,
      tools: false,
      json: false,
      vision: false,
      embeddings: true,
      reasoning: false
    },
    contextWindow: 8192,
    pricingMetadata: {
      source: 'local'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['embedding']
    },
    status: 'available'
  },
  {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    name: 'GPT-4o mini',
    capabilities: {
      streaming: true,
      tools: true,
      json: true,
      vision: true,
      embeddings: false,
      reasoning: false
    },
    contextWindow: 128000,
    pricingMetadata: {
      source: 'provider-default'
    },
    modalityMetadata: {
      input: ['text', 'image'],
      output: ['text']
    },
    status: 'available'
  },
  {
    id: 'text-embedding-3-small',
    providerId: 'openai',
    name: 'Text Embedding 3 Small',
    capabilities: {
      streaming: false,
      tools: false,
      json: false,
      vision: false,
      embeddings: true,
      reasoning: false
    },
    contextWindow: 8191,
    pricingMetadata: {
      source: 'provider-default'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['embedding']
    },
    status: 'available'
  },
  {
    id: 'grok-4.3',
    providerId: 'xai',
    name: 'Grok 4.3',
    capabilities: {
      streaming: true,
      tools: true,
      json: true,
      vision: false,
      embeddings: false,
      reasoning: true
    },
    contextWindow: null,
    pricingMetadata: {
      source: 'provider-default'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'available'
  },
  {
    id: 'deepseek-v4-flash',
    providerId: 'deepseek',
    name: 'DeepSeek V4 Flash',
    capabilities: {
      streaming: true,
      tools: true,
      json: true,
      vision: false,
      embeddings: false,
      reasoning: true
    },
    contextWindow: null,
    pricingMetadata: {
      source: 'provider-default'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'available'
  }
];

export function createModelRegistry(initialModels = DEFAULT_MODELS) {
  const models = new Map();

  function getKey(providerId, modelId) {
    return `${providerId}:${modelId}`;
  }

  function registerModel(model) {
    const validation = validateModelContract(model);

    if (!validation.ok) {
      return {
        ok: false,
        errors: validation.errors
      };
    }

    const normalized = normalizeModelMetadata(model);
    models.set(getKey(normalized.providerId, normalized.id), normalized);

    return {
      ok: true,
      errors: []
    };
  }

  function getModel(providerId, modelId) {
    const model = models.get(getKey(providerId, modelId));

    return model ? normalizeModelMetadata(model) : null;
  }

  function listModels(providerId) {
    return Array.from(models.values())
      .filter((model) => !providerId || model.providerId === providerId)
      .map(normalizeModelMetadata);
  }

  initialModels.forEach((model) => {
    registerModel(model);
  });

  return {
    registerModel,
    getModel,
    listModels
  };
}

const defaultModelRegistry = createModelRegistry();

export function registerModel(model) {
  return defaultModelRegistry.registerModel(model);
}

export function getModel(providerId, modelId) {
  return defaultModelRegistry.getModel(providerId, modelId);
}

export function listModels(providerId) {
  return defaultModelRegistry.listModels(providerId);
}
