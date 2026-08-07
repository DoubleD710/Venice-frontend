export const ROUTING_REQUEST_TYPES = {
  chat: 'chat',
  embedding: 'embedding',
  vision: 'vision',
  tool: 'tool'
};

export const ROUTING_OUTCOME_STATUS = {
  selected: 'selected',
  rejected: 'rejected',
  deferred: 'deferred'
};

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function normalizeCapabilities(capabilities = {}) {
  return {
    streaming: Boolean(capabilities.streaming),
    tools: Boolean(capabilities.tools),
    json: Boolean(capabilities.json),
    vision: Boolean(capabilities.vision),
    embeddings: Boolean(capabilities.embeddings),
    reasoning: Boolean(capabilities.reasoning)
  };
}

function normalizeExecutionRequirements(requirements = {}) {
  return {
    capabilityRequest: normalizeCapabilities(requirements.capabilityRequest),
    modality: requirements.modality || 'text',
    interactive: requirements.interactive !== false,
    allowRemote: requirements.allowRemote !== false,
    allowLocal: requirements.allowLocal !== false
  };
}

// Creates a normalized routing request. This is contract data only, not routing logic.
export function createRoutingRequest({
  id = createId('route'),
  type = ROUTING_REQUEST_TYPES.chat,
  prompt = '',
  messages = [],
  preferredProviderId = '',
  preferredModelId = '',
  executionRequirements = {},
  metadata = {}
} = {}) {
  return {
    id,
    type,
    prompt,
    messages,
    preferredProviderId,
    preferredModelId,
    executionRequirements: normalizeExecutionRequirements(executionRequirements),
    metadata: {
      createdAt: new Date().toISOString(),
      ...metadata
    }
  };
}

export function createRoutingOutcome({
  requestId,
  status = ROUTING_OUTCOME_STATUS.deferred,
  decision = null,
  errors = [],
  warnings = [],
  metadata = {}
} = {}) {
  return {
    type: 'routing_outcome',
    requestId: requestId || '',
    status,
    decision,
    errors,
    warnings,
    metadata
  };
}

export function validateRoutingRequest(request) {
  const errors = [];

  if (!request?.id) {
    errors.push('Routing request id is required');
  }

  if (!Object.values(ROUTING_REQUEST_TYPES).includes(request?.type)) {
    errors.push('Routing request type is invalid');
  }

  if (!request?.executionRequirements || typeof request.executionRequirements !== 'object') {
    errors.push('Routing request executionRequirements are required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateRoutingDecision(decision) {
  const errors = [];

  if (!decision?.selectedProvider?.id) {
    errors.push('Routing decision selectedProvider.id is required');
  }

  if (!decision?.selectedModel?.id) {
    errors.push('Routing decision selectedModel.id is required');
  }

  if (!decision?.selectedComputeTarget?.id) {
    errors.push('Routing decision selectedComputeTarget.id is required');
  }

  if (!decision?.metadata || typeof decision.metadata !== 'object') {
    errors.push('Routing decision metadata is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateRoutingOutcome(outcome) {
  const errors = [];

  if (outcome?.type !== 'routing_outcome') {
    errors.push('Routing outcome type must be routing_outcome');
  }

  if (!Object.values(ROUTING_OUTCOME_STATUS).includes(outcome?.status)) {
    errors.push('Routing outcome status is invalid');
  }

  if (outcome?.status === ROUTING_OUTCOME_STATUS.selected) {
    errors.push(...validateRoutingDecision(outcome.decision).errors);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
