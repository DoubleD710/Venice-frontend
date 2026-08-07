import { createRoutingOutcome, ROUTING_OUTCOME_STATUS } from './routing-contracts.js';

function normalizeComputeTarget(target = {}) {
  return {
    id: target.id || '',
    type: target.type || 'unknown',
    endpointUrl: target.endpointUrl || '',
    metadata: target.metadata || {}
  };
}

function normalizeDecisionMetadata(metadata = {}) {
  return {
    reason: metadata.reason || '',
    decidedBy: metadata.decidedBy || 'future-router',
    policyVersion: metadata.policyVersion || '',
    diagnostics: metadata.diagnostics || {}
  };
}

// Defines a future router result. It records selection; it does not perform selection.
export function createRoutingDecision({
  requestId = '',
  selectedProvider = {},
  selectedModel = {},
  selectedComputeTarget = {},
  capabilityMetadata = {},
  metadata = {}
} = {}) {
  return {
    type: 'routing_decision',
    requestId,
    selectedProvider: {
      id: selectedProvider.id || '',
      label: selectedProvider.label || '',
      type: selectedProvider.type || ''
    },
    selectedModel: {
      id: selectedModel.id || '',
      providerId: selectedModel.providerId || selectedProvider.id || '',
      name: selectedModel.name || selectedModel.id || '',
      status: selectedModel.status || ''
    },
    selectedComputeTarget: normalizeComputeTarget(selectedComputeTarget),
    capabilityMetadata,
    metadata: normalizeDecisionMetadata(metadata)
  };
}

export function createSelectedRoutingOutcome({ requestId, decision, warnings = [], metadata = {} } = {}) {
  return createRoutingOutcome({
    requestId,
    status: ROUTING_OUTCOME_STATUS.selected,
    decision,
    warnings,
    metadata
  });
}

export function createRejectedRoutingOutcome({ requestId, errors = [], warnings = [], metadata = {} } = {}) {
  return createRoutingOutcome({
    requestId,
    status: ROUTING_OUTCOME_STATUS.rejected,
    decision: null,
    errors,
    warnings,
    metadata
  });
}

export const ROUTING_DECISION_EXAMPLES = Object.freeze({
  localModelRequest: createSelectedRoutingOutcome({
    requestId: 'example-local-chat',
    decision: createRoutingDecision({
      requestId: 'example-local-chat',
      selectedProvider: {
        id: 'ollama',
        label: 'Ollama',
        type: 'local'
      },
      selectedModel: {
        id: 'llama3.2',
        providerId: 'ollama',
        name: 'Llama 3.2',
        status: 'available'
      },
      selectedComputeTarget: {
        id: 'local-ollama',
        type: 'local',
        endpointUrl: 'http://localhost:11434/api/generate'
      },
      capabilityMetadata: {
        enabled: {
          streaming: true,
          tools: false,
          json: false,
          vision: false,
          embeddings: false,
          reasoning: false
        }
      },
      metadata: {
        reason: 'Example local chat decision shape'
      }
    })
  }),
  cloudModelRequest: createSelectedRoutingOutcome({
    requestId: 'example-cloud-chat',
    decision: createRoutingDecision({
      requestId: 'example-cloud-chat',
      selectedProvider: {
        id: 'openai',
        label: 'OpenAI',
        type: 'cloud'
      },
      selectedModel: {
        id: 'gpt-4o-mini',
        providerId: 'openai',
        name: 'GPT-4o mini',
        status: 'available'
      },
      selectedComputeTarget: {
        id: 'cloud-openai',
        type: 'remote',
        endpointUrl: 'https://api.openai.com/v1/chat/completions'
      },
      capabilityMetadata: {
        enabled: {
          streaming: true,
          tools: true,
          json: true,
          vision: false,
          embeddings: false,
          reasoning: false
        }
      },
      metadata: {
        reason: 'Example cloud chat decision shape'
      }
    })
  }),
  futureEmbeddingRequest: createSelectedRoutingOutcome({
    requestId: 'example-future-embedding',
    decision: createRoutingDecision({
      requestId: 'example-future-embedding',
      selectedProvider: {
        id: 'future-provider',
        label: 'Future Provider',
        type: 'cloud'
      },
      selectedModel: {
        id: 'future-embedding-model',
        providerId: 'future-provider',
        name: 'Future Embedding Model',
        status: 'available'
      },
      selectedComputeTarget: {
        id: 'future-embedding-target',
        type: 'remote'
      },
      capabilityMetadata: {
        enabled: {
          streaming: false,
          tools: false,
          json: false,
          vision: false,
          embeddings: true,
          reasoning: false
        }
      },
      metadata: {
        reason: 'Example future embedding decision shape'
      }
    })
  }),
  futureVisionRequest: createSelectedRoutingOutcome({
    requestId: 'example-future-vision',
    decision: createRoutingDecision({
      requestId: 'example-future-vision',
      selectedProvider: {
        id: 'future-provider',
        label: 'Future Provider',
        type: 'cloud'
      },
      selectedModel: {
        id: 'future-vision-model',
        providerId: 'future-provider',
        name: 'Future Vision Model',
        status: 'available'
      },
      selectedComputeTarget: {
        id: 'future-vision-target',
        type: 'remote'
      },
      capabilityMetadata: {
        enabled: {
          streaming: true,
          tools: false,
          json: false,
          vision: true,
          embeddings: false,
          reasoning: false
        }
      },
      metadata: {
        reason: 'Example future vision decision shape'
      }
    })
  })
});
