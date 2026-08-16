import {
  createMemoryOperationError,
  createMemoryOperationEvent,
  MEMORY_MERGE_POLICIES,
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS,
  validateMemoryOperationShape
} from './memory-operation-contracts.js';
import { normalizeMemoryOperation } from './memory-operations.js';

export const MEMORY_OPERATION_EXECUTION_STATUS = {
  complete: 'complete',
  error: 'error'
};

export const MEMORY_OPERATION_EXECUTOR_PHASES = {
  received: 'executor_received',
  validated: 'executor_validated',
  dispatched: 'executor_dispatched',
  completed: 'executor_completed',
  error: 'executor_error'
};

function createExecutionEvent(phase, operation, detail = {}) {
  return createMemoryOperationEvent(phase, operation, {
    executor: 'memory-operation-executor',
    ...detail
  });
}

function createNormalizedError(code, message, category = 'execution') {
  return {
    code,
    message,
    category
  };
}

function createExecutionResult(operation, runtimeResult, previousState, resultingState, lifecycleEvents) {
  return {
    type: 'memory_operation_execution_result',
    operationId: operation.operationId,
    idempotencyKey: operation.idempotencyKey,
    operationType: operation.operationType,
    status: MEMORY_OPERATION_EXECUTION_STATUS.complete,
    success: true,
    operation,
    previousState,
    resultingState,
    lifecycleEvents,
    runtimeResult,
    error: '',
    normalizedError: null
  };
}

function createExecutionError(message, operation = null, detail = {}) {
  const normalizedError = createNormalizedError(
    detail.code || 'memory_operation_execution_error',
    message,
    detail.category || 'execution'
  );

  return {
    ...createMemoryOperationError(message, operation, detail),
    type: 'memory_operation_execution_result',
    operationId: operation?.operationId || '',
    idempotencyKey: operation?.idempotencyKey || '',
    operationType: operation?.operationType || '',
    status: MEMORY_OPERATION_EXECUTION_STATUS.error,
    success: false,
    previousState: detail.previousState ?? null,
    resultingState: detail.resultingState ?? null,
    lifecycleEvents: detail.lifecycleEvents || [],
    normalizedError
  };
}

function validateExecutableOperation(operationInput) {
  const operation = normalizeMemoryOperation(operationInput);

  if (!operation) {
    return {
      ok: false,
      errors: ['Memory operation must be an object'],
      operation: null
    };
  }

  const validation = validateMemoryOperationShape(operation);
  const errors = [...validation.errors];

  if (operation.validationStatus !== MEMORY_OPERATION_VALIDATION_STATUS.valid) {
    errors.push('Memory operation validationStatus must be valid before execution');
  }

  if (operation?.operationType === MEMORY_OPERATION_TYPES.put && !operation.payload.candidate) {
    errors.push('Put memory operation requires payload.candidate');
  }

  if (operation?.operationType === MEMORY_OPERATION_TYPES.update && !operation.payload.updates) {
    errors.push('Update memory operation requires payload.updates');
  }

  if (operation?.operationType === MEMORY_OPERATION_TYPES.merge && !operation.mergePolicy) {
    errors.push('Merge memory operation requires mergePolicy');
  }

  if (operation?.operationType === MEMORY_OPERATION_TYPES.merge
    && operation.mergePolicy
    && operation.mergePolicy !== MEMORY_MERGE_POLICIES.targetWins) {
    errors.push(`Unsupported memory mergePolicy: ${operation.mergePolicy}`);
  }

  if (operation?.operationType === MEMORY_OPERATION_TYPES.merge
    && operation.payload?.card
    && Object.keys(operation.payload.card).length > 0) {
    errors.push('Merge memory operation does not support payload.card in v0.1');
  }

  return {
    ok: errors.length === 0,
    errors,
    operation
  };
}

function getPreviousState(runtime, operation) {
  if (!runtime.getCard) {
    return null;
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.put) {
    return null;
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.merge) {
    return operation.targetMemoryIds.map((cardId) => runtime.getCard(cardId));
  }

  return runtime.getCard(operation.targetMemoryIds[0]);
}

function getResultingState(runtime, operation) {
  if (!runtime.getCard) {
    return null;
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.put) {
    return runtime.getCard(operation.payload.card?.id);
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.delete) {
    return runtime.getCard(operation.targetMemoryIds[0]);
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.merge) {
    return operation.targetMemoryIds.map((cardId) => runtime.getCard(cardId));
  }

  return runtime.getCard(operation.targetMemoryIds[0]);
}

function validateExecutionPreconditions(runtime, operation) {
  const errors = [];

  if ([MEMORY_OPERATION_TYPES.update, MEMORY_OPERATION_TYPES.delete, MEMORY_OPERATION_TYPES.expire].includes(operation.operationType)
    && runtime.getCard
    && !runtime.getCard(operation.targetMemoryIds[0])) {
    errors.push('Memory card was not found');
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.merge && runtime.getCard) {
    const missingTargets = operation.targetMemoryIds.filter((cardId) => !runtime.getCard(cardId));

    if (missingTargets.length > 0) {
      errors.push('Both memory cards are required for merge');
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function dispatchOperation(runtime, operation) {
  if (operation.operationType === MEMORY_OPERATION_TYPES.put) {
    const candidateResult = runtime.intakeCandidate(operation.payload.candidate);

    if (candidateResult.status === 'error') {
      return candidateResult;
    }

    return runtime.acceptCandidate(candidateResult.candidate.id, operation.payload.card || {});
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.update) {
    return runtime.updateCard(operation.targetMemoryIds[0], operation.payload.updates);
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.delete) {
    return runtime.deleteCard(operation.targetMemoryIds[0]);
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.expire) {
    return runtime.expireCard(operation.targetMemoryIds[0], operation.payload.expiration || operation.payload);
  }

  if (operation.operationType === MEMORY_OPERATION_TYPES.merge) {
    return runtime.mergeCards(
      operation.targetMemoryIds[0],
      operation.targetMemoryIds[1],
      {
        mergePolicy: operation.mergePolicy
      }
    );
  }

  return createExecutionError('Memory operation operationType is invalid', operation);
}

export function createMemoryOperationExecutor({ runtime } = {}) {
  const listeners = new Set();
  let executionCount = 0;
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

  function execute(operationInput) {
    const lifecycleEvents = [];

    function emitExecutorEvent(phase, operation, detail = {}) {
      const event = createExecutionEvent(phase, operation, detail);

      lifecycleEvents.push(event);
      emit(event);
      return event;
    }

    emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.received, operationInput);

    if (!runtime) {
      emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.error, operationInput, {
        message: 'Memory Runtime is required'
      });
      const result = createExecutionError('Memory Runtime is required', operationInput, {
        lifecycleEvents
      });
      return result;
    }

    const validation = validateExecutableOperation(operationInput);

    if (!validation.ok) {
      emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.error, validation.operation, {
        errors: validation.errors
      });
      const result = createExecutionError(validation.errors[0], validation.operation, {
        errors: validation.errors,
        lifecycleEvents,
        category: validation.operation ? 'precondition' : 'contract'
      });
      return result;
    }

    emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.validated, validation.operation);

    const previousState = getPreviousState(runtime, validation.operation);
    const preconditions = validateExecutionPreconditions(runtime, validation.operation);

    if (!preconditions.ok) {
      emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.error, validation.operation, {
        errors: preconditions.errors
      });
      const result = createExecutionError(preconditions.errors[0], validation.operation, {
        errors: preconditions.errors,
        previousState,
        resultingState: getResultingState(runtime, validation.operation),
        lifecycleEvents,
        category: 'precondition'
      });
      return result;
    }

    emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.dispatched, validation.operation);

    const runtimeResult = dispatchOperation(runtime, validation.operation);
    const resultingState = getResultingState(runtime, validation.operation);

    if (runtimeResult.status === 'error') {
      emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.error, validation.operation, {
        message: runtimeResult.error || 'Memory runtime operation failed'
      });
      const result = createExecutionError(runtimeResult.error || 'Memory runtime operation failed', validation.operation, {
        runtimeResult,
        previousState,
        resultingState,
        lifecycleEvents,
        category: 'runtime'
      });
      return result;
    }

    executionCount += 1;
    emitExecutorEvent(MEMORY_OPERATION_EXECUTOR_PHASES.completed, validation.operation);

    return createExecutionResult(validation.operation, runtimeResult, previousState, resultingState, lifecycleEvents);
  }

  function getDiagnostics() {
    return {
      executionCount,
      lastStatus
    };
  }

  return {
    execute,
    onEvent,
    getDiagnostics
  };
}
