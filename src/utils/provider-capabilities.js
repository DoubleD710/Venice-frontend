import { getProvider } from './provider-registry.js';
import { getResolvedModelCapabilities, resolveModel } from './model-resolution.js';

const DEFAULT_REQUEST = {
  streaming: true,
  tools: false,
  json: false,
  vision: false,
  embeddings: false,
  reasoning: false,
  modelId: ''
};

function getBaseCapabilities(provider, modelResolution = null) {
  const modelCapabilities = getResolvedModelCapabilities(modelResolution);

  return {
    streaming: Boolean(provider?.supportsStreaming) && Boolean(modelCapabilities.streaming),
    tools: Boolean(modelCapabilities.tools),
    json: Boolean(modelCapabilities.json),
    vision: Boolean(modelCapabilities.vision),
    embeddings: Boolean(modelCapabilities.embeddings),
    reasoning: Boolean(modelCapabilities.reasoning),
    requestFormat: provider?.requestFormat || 'unknown',
    modelId: modelResolution?.model?.id || '',
    contextWindow: modelResolution?.model?.contextWindow ?? null
  };
}

// Negotiates requested features against resolved model metadata plus provider transport support.
export function negotiateProviderCapabilities(providerId, requested = {}, resolvedModel = null) {
  const provider = getProvider(providerId);
  const modelResolution = resolvedModel || resolveModel(providerId, requested.modelId);
  const request = {
    ...DEFAULT_REQUEST,
    ...requested
  };

  if (!provider) {
    return {
      ok: false,
      providerId,
      label: 'Unknown',
      type: 'unknown',
      requested: request,
      supported: getBaseCapabilities(null, null),
      enabled: {
        streaming: false,
        tools: false,
        json: false,
        vision: false,
        embeddings: false,
        reasoning: false
      },
      warnings: [],
      errors: ['Unknown provider']
    };
  }

  const supported = getBaseCapabilities(provider, modelResolution);
  const enabled = {
    streaming: request.streaming && supported.streaming,
    tools: request.tools && supported.tools,
    json: request.json && supported.json,
    vision: Boolean(request.vision) && supported.vision,
    embeddings: Boolean(request.embeddings) && supported.embeddings,
    reasoning: Boolean(request.reasoning) && supported.reasoning
  };
  const errors = [];
  const warnings = [...(modelResolution?.warnings || [])];

  if (request.streaming && !supported.streaming) {
    errors.push(`${provider.label} does not support streaming`);
  }

  if (request.tools && !supported.tools) {
    warnings.push(`${modelResolution.model.name} does not advertise tool-call support`);
  }

  if (request.json && !supported.json) {
    warnings.push(`${modelResolution.model.name} does not advertise JSON-mode support`);
  }

  if (request.vision && !supported.vision) {
    warnings.push(`${modelResolution.model.name} does not advertise vision support`);
  }

  if (request.embeddings && !supported.embeddings) {
    warnings.push(`${modelResolution.model.name} does not advertise embedding support`);
  }

  if (request.reasoning && !supported.reasoning) {
    warnings.push(`${modelResolution.model.name} does not advertise reasoning support`);
  }

  return {
    ok: errors.length === 0,
    providerId: provider.id,
    label: provider.label,
    type: provider.type,
    model: modelResolution.model,
    requested: request,
    supported,
    enabled,
    warnings,
    errors
  };
}

export function summarizeNegotiatedCapabilities(negotiated) {
  if (!negotiated?.ok) {
    return negotiated?.errors?.[0] || 'Capabilities unavailable';
  }

  const enabled = [];

  if (negotiated.enabled.streaming) {
    enabled.push('stream');
  }

  if (negotiated.enabled.tools) {
    enabled.push('tools');
  }

  if (negotiated.enabled.json) {
    enabled.push('json');
  }

  if (negotiated.enabled.vision) {
    enabled.push('vision');
  }

  if (negotiated.enabled.embeddings) {
    enabled.push('embeddings');
  }

  if (negotiated.enabled.reasoning) {
    enabled.push('reasoning');
  }

  return enabled.length > 0 ? enabled.join(', ') : 'basic';
}
