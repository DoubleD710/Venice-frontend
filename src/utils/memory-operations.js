import {
  createMemoryOperation,
  createMemoryOperationError,
  createMemoryOperationEvent,
  MEMORY_OPERATION_PHASES,
  MEMORY_OPERATION_VALIDATION_STATUS,
  validateMemoryOperationShape
} from './memory-operation-contracts.js';

function createOperationResult(operation) {
  return {
    type: 'memory_operation_result',
    status: MEMORY_OPERATION_VALIDATION_STATUS.valid,
    operation,
    error: ''
  };
}

function markValidationStatus(operation, validationStatus) {
  return {
    ...operation,
    validationStatus
  };
}

export function normalizeMemoryOperation(operationInput = {}) {
  if (!operationInput || typeof operationInput !== 'object' || Array.isArray(operationInput)) {
    return null;
  }

  return createMemoryOperation(operationInput);
}

export function validateMemoryOperation(operationInput = {}) {
  const operation = normalizeMemoryOperation(operationInput);

  if (!operation) {
    return {
      ok: false,
      errors: ['Memory operation must be an object'],
      operation: null
    };
  }

  const validation = validateMemoryOperationShape(operation);

  return {
    ...validation,
    operation: markValidationStatus(
      operation,
      validation.ok
        ? MEMORY_OPERATION_VALIDATION_STATUS.valid
        : MEMORY_OPERATION_VALIDATION_STATUS.invalid
    )
  };
}

export function createMemoryOperationProcessor() {
  const listeners = new Set();
  let processedCount = 0;
  let lastStatus = 'idle';

  function emit(event) {
    lastStatus = event.phase || lastStatus;
    listeners.forEach((listener) => listener(event));
  }

  function onEvent(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function propose(operationInput = {}) {
    const proposedOperation = normalizeMemoryOperation(operationInput);

    emit(createMemoryOperationEvent(MEMORY_OPERATION_PHASES.proposed, proposedOperation));
    emit(createMemoryOperationEvent(MEMORY_OPERATION_PHASES.normalized, proposedOperation));

    const validation = validateMemoryOperation(proposedOperation);

    if (!validation.ok) {
      emit(createMemoryOperationEvent(MEMORY_OPERATION_PHASES.rejected, validation.operation, {
        errors: validation.errors
      }));
      return createMemoryOperationError(validation.errors[0], validation.operation, {
        errors: validation.errors
      });
    }

    processedCount += 1;
    emit(createMemoryOperationEvent(MEMORY_OPERATION_PHASES.validated, validation.operation));

    return createOperationResult(validation.operation);
  }

  function getDiagnostics() {
    return {
      processedCount,
      lastStatus
    };
  }

  return {
    propose,
    onEvent,
    getDiagnostics
  };
}
