import { normalizeReflectionProposal } from './reflection-contracts.js';
import { listReflectionProposalTypes } from './reflection-types.js';

const REQUIRED_PROPOSAL_FIELDS = [
  'proposalId',
  'proposalType',
  'confidence',
  'evidence',
  'sourceVerificationIds',
  'targetReferences',
  'proposedOperation',
  'rationale',
  'provenance',
  'createdAt'
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function decodeStructuredOutput(structuredOutput) {
  if (typeof structuredOutput === 'string') {
    if (!structuredOutput.trim()) {
      throw new Error('Model reflection response was empty');
    }

    try {
      return JSON.parse(structuredOutput);
    } catch {
      throw new Error('Model reflection structured output is not valid JSON');
    }
  }

  if (!isPlainObject(structuredOutput)) {
    throw new Error('Model reflection structured output must be an object or JSON string');
  }

  return cloneValue(structuredOutput);
}

function getExplicitProvenance(responseMetadata, configuredMetadata, context) {
  const provenance = {};
  const values = {
    providerId: responseMetadata.providerId || configuredMetadata.providerId,
    modelId: responseMetadata.modelId || configuredMetadata.modelId,
    requestId: responseMetadata.requestId || context.requestId
  };

  Object.entries(values).forEach(([field, value]) => {
    if (isNonEmptyString(value)) {
      provenance[field] = value;
    }
  });

  return provenance;
}

function attachExplicitProvenance(proposal, explicitProvenance) {
  if (!isPlainObject(proposal) || Object.keys(explicitProvenance).length === 0) {
    return proposal;
  }

  return {
    ...proposal,
    provenance: {
      ...(isPlainObject(proposal.provenance) ? proposal.provenance : {}),
      ...explicitProvenance
    }
  };
}

function normalizeModelContext(context) {
  if (!isPlainObject(context)) {
    return {};
  }

  const modelContext = {};

  if (isNonEmptyString(context.requestId)) {
    modelContext.requestId = context.requestId;
  }

  if (isPlainObject(context.metadata)) {
    modelContext.metadata = cloneValue(context.metadata);
  }

  return modelContext;
}

export function createModelReflectionRequest(verifiedEvidence, context = {}) {
  return {
    type: 'model_reflection_request',
    verifiedEvidence: cloneValue(verifiedEvidence),
    context: normalizeModelContext(context),
    instruction: 'Return only structured Reflection Proposal candidates. Do not execute operations.',
    responseFormat: {
      type: 'json',
      schemaVersion: 1,
      rootField: 'proposals',
      allowedProposalTypes: listReflectionProposalTypes(),
      requiredProposalFields: [...REQUIRED_PROPOSAL_FIELDS]
    }
  };
}

export function parseModelReflectionResponse(response, {
  providerId = '',
  modelId = '',
  requestId = ''
} = {}) {
  if (!isPlainObject(response)) {
    throw new Error('Model reflection response must be an object');
  }

  const decoded = decodeStructuredOutput(response.structuredOutput);

  if (!Array.isArray(decoded.proposals)) {
    throw new Error('Model reflection structured output must contain a proposals array');
  }

  const responseMetadata = isPlainObject(response.metadata) ? response.metadata : {};
  const explicitProvenance = getExplicitProvenance(
    responseMetadata,
    { providerId, modelId },
    { requestId }
  );

  return decoded.proposals.map((proposal) => {
    const candidate = attachExplicitProvenance(proposal, explicitProvenance);

    return normalizeReflectionProposal(candidate);
  });
}

export function createModelReflectionStrategy({
  modelClient,
  providerId = '',
  modelId = ''
} = {}) {
  async function reflect(verifiedEvidence, context = {}, { signal } = {}) {
    if (!modelClient || typeof modelClient.generate !== 'function') {
      throw new Error('Model Reflection Strategy requires an injected model client');
    }

    const request = createModelReflectionRequest(verifiedEvidence, context);
    const response = await modelClient.generate(request, { signal });

    return parseModelReflectionResponse(response, {
      providerId,
      modelId,
      requestId: context.requestId || ''
    });
  }

  return {
    reflect
  };
}
