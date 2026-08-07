import { createRoutingRequest, ROUTING_REQUEST_TYPES } from './routing-contracts.js';

function normalizeExecutionRequirements(requirements = {}) {
  return {
    capabilityRequest: {
      streaming: Boolean(requirements.capabilityRequest?.streaming),
      tools: Boolean(requirements.capabilityRequest?.tools),
      json: Boolean(requirements.capabilityRequest?.json),
      vision: Boolean(requirements.capabilityRequest?.vision),
      embeddings: Boolean(requirements.capabilityRequest?.embeddings),
      reasoning: Boolean(requirements.capabilityRequest?.reasoning)
    },
    modality: requirements.modality || 'text',
    interactive: requirements.interactive !== false,
    allowRemote: requirements.allowRemote !== false,
    allowLocal: requirements.allowLocal !== false
  };
}

// Defines the input shape a future router would receive.
// This module does not choose a provider, model, or compute target.
export function createRoutingContext({
  request,
  resolvedModel,
  provider,
  capabilities,
  executionRequirements = {},
  candidateComputeTargets = [],
  metadata = {}
} = {}) {
  return {
    type: 'routing_context',
    request,
    resolvedModel,
    provider,
    capabilities,
    executionRequirements: normalizeExecutionRequirements(executionRequirements),
    candidateComputeTargets,
    metadata
  };
}

export function validateRoutingContext(context) {
  const errors = [];

  if (context?.type !== 'routing_context') {
    errors.push('Routing context type must be routing_context');
  }

  if (!context?.request?.id) {
    errors.push('Routing context request is required');
  }

  if (!context?.resolvedModel?.id) {
    errors.push('Routing context resolvedModel is required');
  }

  if (!context?.provider?.id) {
    errors.push('Routing context provider is required');
  }

  if (!context?.capabilities?.enabled) {
    errors.push('Routing context capability metadata is required');
  }

  if (!Array.isArray(context?.candidateComputeTargets)) {
    errors.push('Routing context candidateComputeTargets must be an array');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export const ROUTING_CONTEXT_EXAMPLES = Object.freeze({
  localModelRequest: createRoutingContext({
    request: createRoutingRequest({
      id: 'example-local-chat',
      type: ROUTING_REQUEST_TYPES.chat,
      preferredProviderId: 'ollama',
      preferredModelId: 'llama3.2',
      executionRequirements: {
        capabilityRequest: {
          streaming: true
        },
        allowRemote: false,
        allowLocal: true
      },
      metadata: {
        createdAt: 'example'
      }
    }),
    provider: {
      id: 'ollama',
      type: 'local'
    },
    resolvedModel: {
      id: 'llama3.2',
      providerId: 'ollama',
      status: 'available'
    },
    capabilities: {
      enabled: {
        streaming: true,
        tools: false,
        json: false,
        vision: false,
        embeddings: false,
        reasoning: false
      }
    },
    executionRequirements: {
      capabilityRequest: {
        streaming: true
      },
      allowRemote: false,
      allowLocal: true
    },
    candidateComputeTargets: [
      {
        id: 'local-ollama',
        type: 'local'
      }
    ]
  }),
  cloudModelRequest: createRoutingContext({
    request: createRoutingRequest({
      id: 'example-cloud-chat',
      type: ROUTING_REQUEST_TYPES.chat,
      preferredProviderId: 'openai',
      preferredModelId: 'gpt-4o-mini',
      executionRequirements: {
        capabilityRequest: {
          streaming: true,
          tools: true,
          json: true
        },
        allowRemote: true,
        allowLocal: false
      },
      metadata: {
        createdAt: 'example'
      }
    }),
    provider: {
      id: 'openai',
      type: 'cloud'
    },
    resolvedModel: {
      id: 'gpt-4o-mini',
      providerId: 'openai',
      status: 'available'
    },
    capabilities: {
      enabled: {
        streaming: true,
        tools: true,
        json: true,
        vision: false,
        embeddings: false,
        reasoning: false
      }
    },
    executionRequirements: {
      capabilityRequest: {
        streaming: true,
        tools: true,
        json: true
      },
      allowRemote: true,
      allowLocal: false
    },
    candidateComputeTargets: [
      {
        id: 'cloud-openai',
        type: 'remote'
      }
    ]
  }),
  futureEmbeddingRequest: createRoutingContext({
    request: createRoutingRequest({
      id: 'example-future-embedding',
      type: ROUTING_REQUEST_TYPES.embedding,
      executionRequirements: {
        capabilityRequest: {
          embeddings: true
        },
        modality: 'text'
      },
      metadata: {
        createdAt: 'example'
      }
    }),
    provider: {
      id: 'future-provider',
      type: 'cloud'
    },
    resolvedModel: {
      id: 'future-embedding-model',
      providerId: 'future-provider',
      status: 'available'
    },
    capabilities: {
      enabled: {
        streaming: false,
        tools: false,
        json: false,
        vision: false,
        embeddings: true,
        reasoning: false
      }
    },
    executionRequirements: {
      capabilityRequest: {
        embeddings: true
      },
      modality: 'text'
    },
    candidateComputeTargets: []
  }),
  futureVisionRequest: createRoutingContext({
    request: createRoutingRequest({
      id: 'example-future-vision',
      type: ROUTING_REQUEST_TYPES.vision,
      executionRequirements: {
        capabilityRequest: {
          vision: true
        },
        modality: 'image'
      },
      metadata: {
        createdAt: 'example'
      }
    }),
    provider: {
      id: 'future-provider',
      type: 'cloud'
    },
    resolvedModel: {
      id: 'future-vision-model',
      providerId: 'future-provider',
      status: 'available'
    },
    capabilities: {
      enabled: {
        streaming: true,
        tools: false,
        json: false,
        vision: true,
        embeddings: false,
        reasoning: false
      }
    },
    executionRequirements: {
      capabilityRequest: {
        vision: true
      },
      modality: 'image'
    },
    candidateComputeTargets: []
  })
});
