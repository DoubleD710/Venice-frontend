export const MEMORY_OPERATION_TYPES = {
  put: 'put',
  update: 'update',
  delete: 'delete',
  expire: 'expire',
  merge: 'merge'
};

export const MEMORY_OPERATION_VALIDATION_STATUS = {
  pending: 'pending',
  valid: 'valid',
  invalid: 'invalid'
};

export const MEMORY_OPERATION_PHASES = {
  proposed: 'proposed',
  normalized: 'normalized',
  validated: 'validated',
  rejected: 'rejected',
  error: 'error'
};

function normalizeTargetMemoryIds(targetMemoryIds = []) {
  if (Array.isArray(targetMemoryIds)) {
    return targetMemoryIds.filter(Boolean);
  }

  return targetMemoryIds ? [targetMemoryIds] : [];
}

function normalizeObject(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function createMemoryOperation({
  operationId = '',
  operationType = '',
  targetMemoryIds = [],
  payload = {},
  proposalMetadata = {},
  timestamp = '',
  validationStatus = MEMORY_OPERATION_VALIDATION_STATUS.pending
} = {}) {
  return {
    operationId,
    operationType,
    targetMemoryIds: normalizeTargetMemoryIds(targetMemoryIds),
    payload: normalizeObject(payload),
    proposalMetadata: normalizeObject(proposalMetadata),
    timestamp,
    validationStatus
  };
}

export function createMemoryOperationEvent(phase, operation, detail = {}) {
  return {
    type: 'memory_operation_event',
    phase,
    operationId: operation?.operationId || '',
    operationType: operation?.operationType || '',
    timestamp: operation?.timestamp || '',
    ...detail
  };
}

export function createMemoryOperationError(message, operation = null, detail = {}) {
  return {
    type: 'memory_operation_result',
    status: MEMORY_OPERATION_VALIDATION_STATUS.invalid,
    operation,
    error: message,
    ...detail
  };
}

export function isValidMemoryOperationType(operationType) {
  return Object.values(MEMORY_OPERATION_TYPES).includes(operationType);
}

export function isValidMemoryOperationValidationStatus(validationStatus) {
  return Object.values(MEMORY_OPERATION_VALIDATION_STATUS).includes(validationStatus);
}

export function validateMemoryOperationShape(operation) {
  const errors = [];

  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    return {
      ok: false,
      errors: ['Memory operation must be an object']
    };
  }

  if (!operation.operationId) {
    errors.push('Memory operation operationId is required');
  }

  if (!isValidMemoryOperationType(operation.operationType)) {
    errors.push('Memory operation operationType is invalid');
  }

  if (!Array.isArray(operation.targetMemoryIds)) {
    errors.push('Memory operation targetMemoryIds must be an array');
  }

  if (!operation.payload || typeof operation.payload !== 'object' || Array.isArray(operation.payload)) {
    errors.push('Memory operation payload must be an object');
  }

  if (!operation.proposalMetadata || typeof operation.proposalMetadata !== 'object' || Array.isArray(operation.proposalMetadata)) {
    errors.push('Memory operation proposalMetadata must be an object');
  }

  if (!operation.timestamp) {
    errors.push('Memory operation timestamp is required');
  }

  if (!isValidMemoryOperationValidationStatus(operation.validationStatus)) {
    errors.push('Memory operation validationStatus is invalid');
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.merge && operation.targetMemoryIds?.length < 2) {
    errors.push('Merge memory operation requires at least two targetMemoryIds');
  }

  if ([MEMORY_OPERATION_TYPES.update, MEMORY_OPERATION_TYPES.delete, MEMORY_OPERATION_TYPES.expire].includes(operation.operationType)
    && operation.targetMemoryIds?.length < 1) {
    errors.push(`${operation.operationType} memory operation requires a targetMemoryId`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
