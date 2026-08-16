import {
  isValidRelationshipConfidence,
  isValidRelationshipId,
  isValidRelationshipProvenance,
  validateRelationship
} from './relationship-contracts.js';

export const RELATIONSHIP_OPERATION_TYPES = {
  link: 'link',
  unlink: 'unlink',
  strengthen: 'strengthen',
  weaken: 'weaken'
};

export const RELATIONSHIP_OPERATION_VALIDATION_STATUS = {
  pending: 'pending',
  valid: 'valid',
  invalid: 'invalid'
};

export const RELATIONSHIP_OPERATION_PHASES = {
  proposed: 'proposed',
  normalized: 'normalized',
  validated: 'validated',
  rejected: 'rejected',
  error: 'error'
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneObject(value) {
  if (value === undefined) {
    return {};
  }

  return isPlainObject(value) ? JSON.parse(JSON.stringify(value)) : value;
}

export function createRelationshipOperation({
  operationId = '',
  idempotencyKey = '',
  operationType = '',
  relationshipId = '',
  payload = {},
  proposalMetadata = {},
  provenance = {},
  timestamp = '',
  validationStatus = RELATIONSHIP_OPERATION_VALIDATION_STATUS.pending
} = {}) {
  return {
    operationId,
    idempotencyKey,
    operationType,
    relationshipId,
    payload: cloneObject(payload),
    proposalMetadata: cloneObject(proposalMetadata),
    provenance: cloneObject(provenance),
    timestamp,
    validationStatus
  };
}

export function createRelationshipOperationEvent(phase, operation, detail = {}) {
  return {
    type: 'relationship_operation_event',
    phase,
    operationId: operation?.operationId || '',
    idempotencyKey: operation?.idempotencyKey || '',
    operationType: operation?.operationType || '',
    relationshipId: operation?.relationshipId || '',
    timestamp: operation?.timestamp || '',
    ...cloneObject(detail)
  };
}

export function createRelationshipOperationError(message, operation = null, errors = [message]) {
  return {
    type: 'relationship_operation_result',
    status: RELATIONSHIP_OPERATION_VALIDATION_STATUS.invalid,
    operation,
    error: message,
    errors: [...errors]
  };
}

export function isValidRelationshipOperationType(operationType) {
  return Object.values(RELATIONSHIP_OPERATION_TYPES).includes(operationType);
}

export function isValidRelationshipOperationValidationStatus(validationStatus) {
  return Object.values(RELATIONSHIP_OPERATION_VALIDATION_STATUS).includes(validationStatus);
}

export function isValidRelationshipStrengthAdjustment(adjustment) {
  return isValidRelationshipConfidence(adjustment) && adjustment > 0;
}

export function validateRelationshipOperationShape(operation) {
  const errors = [];

  if (!isPlainObject(operation)) {
    return {
      ok: false,
      errors: ['Relationship operation must be an object']
    };
  }

  if (!isValidRelationshipId(operation.operationId)) {
    errors.push('Relationship operation operationId is required');
  }

  if (operation.idempotencyKey !== undefined && typeof operation.idempotencyKey !== 'string') {
    errors.push('Relationship operation idempotencyKey must be a string');
  }

  if (!isValidRelationshipOperationType(operation.operationType)) {
    errors.push('Relationship operation operationType is invalid');
  }

  if (!isValidRelationshipId(operation.relationshipId)) {
    errors.push('Relationship operation relationshipId is required');
  }

  if (!isPlainObject(operation.payload)) {
    errors.push('Relationship operation payload must be an object');
  }

  if (!isPlainObject(operation.proposalMetadata)) {
    errors.push('Relationship operation proposalMetadata must be an object');
  }

  if (!isPlainObject(operation.provenance)) {
    errors.push('Relationship operation provenance must be an object');
  } else if (Object.keys(operation.provenance).length > 0
    && !isValidRelationshipProvenance(operation.provenance)) {
    errors.push('Relationship operation provenance.source is required when provenance is provided');
  }

  if (typeof operation.timestamp !== 'string' || !operation.timestamp) {
    errors.push('Relationship operation timestamp is required');
  }

  if (!isValidRelationshipOperationValidationStatus(operation.validationStatus)) {
    errors.push('Relationship operation validationStatus is invalid');
  }

  if (operation.operationType === RELATIONSHIP_OPERATION_TYPES.link && isPlainObject(operation.payload)) {
    const relationship = operation.payload.relationship;
    const relationshipValidation = validateRelationship(relationship);

    if (!relationshipValidation.ok) {
      relationshipValidation.errors.forEach((error) => {
        errors.push(`Link relationship payload: ${error}`);
      });
    } else if (relationship.relationshipId !== operation.relationshipId) {
      errors.push('Link relationshipId must match payload.relationship.relationshipId');
    }
  }

  if ([
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    RELATIONSHIP_OPERATION_TYPES.weaken
  ].includes(operation.operationType) && isPlainObject(operation.payload)
    && !isValidRelationshipStrengthAdjustment(operation.payload.confidenceDelta)) {
    errors.push(`${operation.operationType} relationship operation confidenceDelta must be greater than 0 and at most 1`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
