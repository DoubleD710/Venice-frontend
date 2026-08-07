import { normalizeModelMetadata } from './model-contracts.js';
import { getModel } from './model-registry.js';
import { getProvider } from './provider-registry.js';

function inferModelFromProvider(provider, modelId) {
  return normalizeModelMetadata({
    id: modelId,
    providerId: provider.id,
    name: modelId,
    capabilities: {
      streaming: Boolean(provider.supportsStreaming),
      tools: Boolean(provider.supportsTools),
      json: provider.requestFormat === 'openai-chat-completions',
      vision: false,
      embeddings: false,
      reasoning: false
    },
    contextWindow: null,
    pricingMetadata: {
      source: provider.type === 'local' ? 'local' : 'unknown'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'unregistered'
  });
}

export function resolveModel(providerId, modelId) {
  const provider = getProvider(providerId);

  if (!provider) {
    return {
      ok: false,
      provider: null,
      model: null,
      registered: false,
      warnings: [],
      errors: ['Unknown provider']
    };
  }

  const requestedModelId = modelId || provider.defaultModel;
  const registeredModel = getModel(provider.id, requestedModelId);

  if (registeredModel) {
    return {
      ok: true,
      provider,
      model: registeredModel,
      registered: true,
      warnings: [],
      errors: []
    };
  }

  return {
    ok: true,
    provider,
    model: inferModelFromProvider(provider, requestedModelId),
    registered: false,
    warnings: [`${provider.label} model "${requestedModelId}" is not registered; using provider defaults`],
    errors: []
  };
}

export function getResolvedModelCapabilities(resolution) {
  return resolution?.model?.capabilities || {
    streaming: false,
    tools: false,
    json: false,
    vision: false,
    embeddings: false,
    reasoning: false
  };
}
