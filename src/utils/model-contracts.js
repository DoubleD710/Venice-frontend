const DEFAULT_CAPABILITIES = {
  streaming: true,
  tools: false,
  json: false,
  vision: false,
  embeddings: false,
  reasoning: false
};

const DEFAULT_PRICING = {
  inputPerMillionTokens: null,
  outputPerMillionTokens: null,
  currency: 'USD',
  source: 'unknown'
};

const DEFAULT_MODALITY = {
  input: ['text'],
  output: ['text']
};

export function normalizeModelCapabilities(capabilities = {}) {
  return {
    ...DEFAULT_CAPABILITIES,
    ...capabilities
  };
}

export function normalizeModelMetadata(model) {
  return {
    id: model.id,
    providerId: model.providerId,
    name: model.name || model.id,
    capabilities: normalizeModelCapabilities(model.capabilities),
    contextWindow: Number.isFinite(model.contextWindow) ? model.contextWindow : null,
    pricingMetadata: {
      ...DEFAULT_PRICING,
      ...(model.pricingMetadata || {})
    },
    modalityMetadata: {
      ...DEFAULT_MODALITY,
      ...(model.modalityMetadata || {})
    },
    status: model.status || 'available'
  };
}

export function validateModelContract(model) {
  const errors = [];

  if (!model?.id) {
    errors.push('Model id is required');
  }

  if (!model?.providerId) {
    errors.push('Model providerId is required');
  }

  if (!model?.name) {
    errors.push('Model name is required');
  }

  if (!model?.capabilities || typeof model.capabilities !== 'object') {
    errors.push('Model capabilities are required');
  }

  if (!Object.prototype.hasOwnProperty.call(model || {}, 'contextWindow')) {
    errors.push('Model contextWindow is required');
  }

  if (!model?.pricingMetadata || typeof model.pricingMetadata !== 'object') {
    errors.push('Model pricingMetadata is required');
  }

  if (!model?.modalityMetadata || typeof model.modalityMetadata !== 'object') {
    errors.push('Model modalityMetadata is required');
  }

  if (!model?.status) {
    errors.push('Model status is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
