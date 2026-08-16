import {
  createRelationshipOperation,
  createRelationshipOperationError,
  createRelationshipOperationEvent,
  RELATIONSHIP_OPERATION_PHASES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS,
  validateRelationshipOperationShape
} from './relationship-operation-contracts.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function withValidationStatus(operation, validationStatus) {
  return {
    ...operation,
    validationStatus
  };
}

function createValidResult(operation) {
  return {
    type: 'relationship_operation_result',
    status: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid,
    operation,
    error: '',
    errors: []
  };
}

export function normalizeRelationshipOperation(operationInput = {}) {
  if (!isPlainObject(operationInput)) {
    return null;
  }

  return createRelationshipOperation(operationInput);
}

export function validateRelationshipOperation(operationInput = {}) {
  const operation = normalizeRelationshipOperation(operationInput);

  if (!operation) {
    return {
      ok: false,
      errors: ['Relationship operation must be an object'],
      operation: null
    };
  }

  const validation = validateRelationshipOperationShape(operation);

  return {
    ...validation,
    operation: withValidationStatus(
      operation,
      validation.ok
        ? RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
        : RELATIONSHIP_OPERATION_VALIDATION_STATUS.invalid
    )
  };
}

// Proposal events describe contract processing only; no relationship state exists here.
export function proposeRelationshipOperation(operationInput = {}, onEvent = null) {
  const emit = typeof onEvent === 'function' ? onEvent : () => {};
  const normalizedOperation = normalizeRelationshipOperation(operationInput);

  emit(createRelationshipOperationEvent(
    RELATIONSHIP_OPERATION_PHASES.proposed,
    normalizedOperation
  ));
  emit(createRelationshipOperationEvent(
    RELATIONSHIP_OPERATION_PHASES.normalized,
    normalizedOperation
  ));

  const validation = validateRelationshipOperation(operationInput);

  if (!validation.ok) {
    emit(createRelationshipOperationEvent(
      RELATIONSHIP_OPERATION_PHASES.rejected,
      validation.operation,
      { errors: validation.errors }
    ));

    return createRelationshipOperationError(
      validation.errors[0],
      validation.operation,
      validation.errors
    );
  }

  emit(createRelationshipOperationEvent(
    RELATIONSHIP_OPERATION_PHASES.validated,
    validation.operation
  ));

  return createValidResult(validation.operation);
}
