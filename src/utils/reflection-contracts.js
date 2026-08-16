import { isValidObservationTimestamp } from './observation-contracts.js';
import { isValidVerificationConfidence } from './verification-contracts.js';
import {
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS
} from './memory-operation-contracts.js';
import {
  normalizeMemoryOperation,
  validateMemoryOperation
} from './memory-operations.js';
import {
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import {
  normalizeRelationshipOperation,
  validateRelationshipOperation
} from './relationship-operations.js';
import {
  isValidReflectionProposalType,
  REFLECTION_PROPOSAL_TYPES
} from './reflection-types.js';

export const MAX_REFLECTION_RATIONALE_LENGTH = 1000;

const OPERATION_RULES = {
  [REFLECTION_PROPOSAL_TYPES.memoryPut]: {
    domain: 'memory',
    operationType: MEMORY_OPERATION_TYPES.put
  },
  [REFLECTION_PROPOSAL_TYPES.memoryUpdate]: {
    domain: 'memory',
    operationType: MEMORY_OPERATION_TYPES.update
  },
  [REFLECTION_PROPOSAL_TYPES.memoryMerge]: {
    domain: 'memory',
    operationType: MEMORY_OPERATION_TYPES.merge
  },
  [REFLECTION_PROPOSAL_TYPES.memoryExpire]: {
    domain: 'memory',
    operationType: MEMORY_OPERATION_TYPES.expire
  },
  [REFLECTION_PROPOSAL_TYPES.relationshipLink]: {
    domain: 'relationship',
    operationType: RELATIONSHIP_OPERATION_TYPES.link
  },
  [REFLECTION_PROPOSAL_TYPES.relationshipUnlink]: {
    domain: 'relationship',
    operationType: RELATIONSHIP_OPERATION_TYPES.unlink
  },
  [REFLECTION_PROPOSAL_TYPES.relationshipStrengthen]: {
    domain: 'relationship',
    operationType: RELATIONSHIP_OPERATION_TYPES.strengthen
  },
  [REFLECTION_PROPOSAL_TYPES.relationshipWeaken]: {
    domain: 'relationship',
    operationType: RELATIONSHIP_OPERATION_TYPES.weaken
  }
};

const OPTIONAL_PROVENANCE_ID_FIELDS = [
  'providerId',
  'modelId',
  'requestId'
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneObject(value) {
  if (value === undefined) {
    return {};
  }

  return isPlainObject(value) ? JSON.parse(JSON.stringify(value)) : value;
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidStringArray(value, { requireItems = false } = {}) {
  return Array.isArray(value)
    && (!requireItems || value.length > 0)
    && value.every(isNonEmptyString)
    && new Set(value).size === value.length;
}

function sameStringSet(left, right) {
  return left.length === right.length
    && left.every((value) => right.includes(value));
}

export function isValidReflectionConfidence(confidence) {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

export function isValidReflectionTimestamp(timestamp) {
  return isValidObservationTimestamp(timestamp);
}

export function createReflectionEvidence({
  evidenceId = '',
  verificationId = '',
  observationId = '',
  findingIds = [],
  verificationConfidence = null,
  metadata = {}
} = {}) {
  return {
    evidenceId,
    verificationId,
    observationId,
    findingIds: Array.isArray(findingIds) ? [...findingIds] : findingIds,
    verificationConfidence,
    metadata: cloneObject(metadata)
  };
}

export function normalizeReflectionEvidence(evidence = {}) {
  return isPlainObject(evidence) ? createReflectionEvidence(evidence) : evidence;
}

export function validateReflectionEvidence(evidence) {
  const errors = [];

  if (!isPlainObject(evidence)) {
    return {
      ok: false,
      errors: ['Reflection evidence must be an object']
    };
  }

  if (!isNonEmptyString(evidence.evidenceId)) {
    errors.push('Reflection evidence evidenceId is required');
  }

  if (!isNonEmptyString(evidence.verificationId)) {
    errors.push('Reflection evidence verificationId is required');
  }

  if (!isNonEmptyString(evidence.observationId)) {
    errors.push('Reflection evidence observationId is required');
  }

  if (!isValidStringArray(evidence.findingIds, { requireItems: true })) {
    errors.push('Reflection evidence findingIds must contain unique identifiers');
  }

  if (evidence.verificationConfidence !== null
    && !isValidVerificationConfidence(evidence.verificationConfidence)) {
    errors.push('Reflection evidence verificationConfidence must be null or between 0 and 1');
  }

  if (!isPlainObject(evidence.metadata)) {
    errors.push('Reflection evidence metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createReflectionTargetReference({
  type = '',
  id = '',
  metadata = {}
} = {}) {
  return {
    type,
    id,
    metadata: cloneObject(metadata)
  };
}

export function normalizeReflectionTargetReference(reference = {}) {
  return isPlainObject(reference) ? createReflectionTargetReference(reference) : reference;
}

export function validateReflectionTargetReference(reference) {
  const errors = [];

  if (!isPlainObject(reference)) {
    return {
      ok: false,
      errors: ['Reflection target reference must be an object']
    };
  }

  if (!isNonEmptyString(reference.type)) {
    errors.push('Reflection target reference type is required');
  }

  if (!isNonEmptyString(reference.id)) {
    errors.push('Reflection target reference id is required');
  }

  if (!isPlainObject(reference.metadata)) {
    errors.push('Reflection target reference metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function isValidReflectionProvenance(provenance) {
  if (!isPlainObject(provenance)
    || !isNonEmptyString(provenance.source)
    || !isNonEmptyString(provenance.proposalId)
    || !isValidStringArray(provenance.verificationIds, { requireItems: true })) {
    return false;
  }

  const optionalIdsValid = OPTIONAL_PROVENANCE_ID_FIELDS.every((field) => (
    provenance[field] === undefined || isNonEmptyString(provenance[field])
  ));
  const observationIdsValid = provenance.observationIds === undefined
    || isValidStringArray(provenance.observationIds);
  const operationIdsValid = provenance.operationIds === undefined
    || isValidStringArray(provenance.operationIds);

  return optionalIdsValid && observationIdsValid && operationIdsValid;
}

function normalizeProposedOperation(proposalType, operation) {
  if (!isPlainObject(operation)) {
    return operation;
  }

  const rule = OPERATION_RULES[proposalType];
  const clonedOperation = cloneValue(operation);

  if (rule?.domain === 'memory') {
    return normalizeMemoryOperation(clonedOperation);
  }

  if (rule?.domain === 'relationship') {
    return normalizeRelationshipOperation(clonedOperation);
  }

  return clonedOperation;
}

export function validateReflectionProposedOperation(proposalType, operation) {
  const rule = OPERATION_RULES[proposalType];
  const errors = [];

  if (!rule) {
    return {
      ok: false,
      errors: ['Reflection proposedOperation cannot be validated for proposalType']
    };
  }

  if (!isPlainObject(operation)) {
    return {
      ok: false,
      errors: ['Reflection proposedOperation must be an object']
    };
  }

  const validation = rule.domain === 'memory'
    ? validateMemoryOperation(operation)
    : validateRelationshipOperation(operation);

  validation.errors.forEach((error) => {
    errors.push(`Reflection proposedOperation: ${error}`);
  });

  if (operation.operationType !== rule.operationType) {
    errors.push(`Reflection proposalType requires ${rule.operationType} operation`);
  }

  const validStatus = rule.domain === 'memory'
    ? MEMORY_OPERATION_VALIDATION_STATUS.valid
    : RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid;

  if (operation.validationStatus !== validStatus) {
    errors.push('Reflection proposedOperation validationStatus must be valid');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createReflectionProposal({
  proposalId = '',
  proposalType = '',
  confidence = null,
  evidence = [],
  sourceVerificationIds = [],
  targetReferences = [],
  proposedOperation = null,
  rationale = '',
  provenance = {},
  metadata = {},
  createdAt = ''
} = {}) {
  return {
    proposalId,
    proposalType,
    confidence,
    evidence: Array.isArray(evidence)
      ? evidence.map(normalizeReflectionEvidence)
      : evidence,
    sourceVerificationIds: Array.isArray(sourceVerificationIds)
      ? [...sourceVerificationIds]
      : sourceVerificationIds,
    targetReferences: Array.isArray(targetReferences)
      ? targetReferences.map(normalizeReflectionTargetReference)
      : targetReferences,
    proposedOperation: normalizeProposedOperation(proposalType, proposedOperation),
    rationale,
    provenance: cloneObject(provenance),
    metadata: cloneObject(metadata),
    createdAt
  };
}

export function normalizeReflectionProposal(proposal = {}) {
  return isPlainObject(proposal) ? createReflectionProposal(proposal) : null;
}

export function createReflectionError(message, proposal = null, detail = {}) {
  return {
    type: 'reflection_contract_error',
    message,
    proposalId: proposal?.proposalId || '',
    detail: cloneObject(detail)
  };
}

export function validateReflectionProposal(proposal) {
  const errors = [];

  if (!isPlainObject(proposal)) {
    return {
      ok: false,
      errors: ['Reflection proposal must be an object'],
      normalizedErrors: [createReflectionError('Reflection proposal must be an object')]
    };
  }

  if (!isNonEmptyString(proposal.proposalId)) {
    errors.push('Reflection proposal proposalId is required');
  }

  if (!isValidReflectionProposalType(proposal.proposalType)) {
    errors.push('Reflection proposal proposalType is invalid');
  }

  if (!isValidReflectionConfidence(proposal.confidence)) {
    errors.push('Reflection proposal confidence must be between 0 and 1');
  }

  if (!isValidStringArray(proposal.sourceVerificationIds, { requireItems: true })) {
    errors.push('Reflection proposal sourceVerificationIds must contain unique identifiers');
  }

  if (!Array.isArray(proposal.evidence) || proposal.evidence.length === 0) {
    errors.push('Reflection proposal evidence is required');
  } else {
    proposal.evidence.forEach((evidence, index) => {
      validateReflectionEvidence(evidence).errors.forEach((error) => {
        errors.push(`Reflection evidence ${index}: ${error}`);
      });
    });

    if (Array.isArray(proposal.sourceVerificationIds)) {
      const evidenceVerificationIds = [...new Set(
        proposal.evidence
          .filter(isPlainObject)
          .map((evidence) => evidence.verificationId)
          .filter(isNonEmptyString)
      )];

      if (!sameStringSet(proposal.sourceVerificationIds, evidenceVerificationIds)) {
        errors.push('Reflection evidence must cover every sourceVerificationId');
      }
    }
  }

  if (!Array.isArray(proposal.targetReferences) || proposal.targetReferences.length === 0) {
    errors.push('Reflection proposal targetReferences are required');
  } else {
    proposal.targetReferences.forEach((reference, index) => {
      validateReflectionTargetReference(reference).errors.forEach((error) => {
        errors.push(`Reflection target reference ${index}: ${error}`);
      });
    });
  }

  validateReflectionProposedOperation(
    proposal.proposalType,
    proposal.proposedOperation
  ).errors.forEach((error) => {
    errors.push(error);
  });

  if (!isNonEmptyString(proposal.rationale)
    || proposal.rationale.length > MAX_REFLECTION_RATIONALE_LENGTH) {
    errors.push(`Reflection proposal rationale must contain 1 to ${MAX_REFLECTION_RATIONALE_LENGTH} characters`);
  }

  if (!isValidReflectionProvenance(proposal.provenance)) {
    errors.push('Reflection proposal provenance is invalid');
  } else {
    if (proposal.provenance.proposalId !== proposal.proposalId) {
      errors.push('Reflection provenance proposalId must match proposalId');
    }

    if (Array.isArray(proposal.sourceVerificationIds)
      && !sameStringSet(proposal.provenance.verificationIds, proposal.sourceVerificationIds)) {
      errors.push('Reflection provenance verificationIds must match sourceVerificationIds');
    }
  }

  if (!isPlainObject(proposal.metadata)) {
    errors.push('Reflection proposal metadata must be an object');
  }

  if (!isValidReflectionTimestamp(proposal.createdAt)) {
    errors.push('Reflection proposal createdAt must be an explicit ISO 8601 timestamp');
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedErrors: errors.map((error) => createReflectionError(error, proposal))
  };
}

export {
  isValidReflectionProposalType,
  REFLECTION_PROPOSAL_TYPES
};
