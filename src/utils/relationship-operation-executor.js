import {
  createRelationshipOperationEvent,
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import {
  normalizeRelationshipOperation,
  validateRelationshipOperation
} from './relationship-operations.js';

export const RELATIONSHIP_OPERATION_EXECUTION_STATUS = {
  complete: 'complete',
  error: 'error'
};

export const RELATIONSHIP_OPERATION_EXECUTOR_PHASES = {
  received: 'executor_received',
  contractValidated: 'executor_contract_validated',
  preconditionsValidated: 'executor_preconditions_validated',
  dispatched: 'executor_dispatched',
  completed: 'executor_completed',
  error: 'executor_error'
};

const RUNTIME_METHODS = {
  [RELATIONSHIP_OPERATION_TYPES.link]: 'linkRelationship',
  [RELATIONSHIP_OPERATION_TYPES.unlink]: 'unlinkRelationship',
  [RELATIONSHIP_OPERATION_TYPES.strengthen]: 'strengthenRelationship',
  [RELATIONSHIP_OPERATION_TYPES.weaken]: 'weakenRelationship'
};

function cloneOutcome(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function createNormalizedError(code, message, category) {
  return {
    code,
    message,
    category
  };
}

function createExecutionEvent(phase, operation, detail = {}) {
  return createRelationshipOperationEvent(phase, operation, {
    executor: 'relationship-operation-executor',
    ...detail
  });
}

function createExecutionResult(operation, adapterMethod, outcome, lifecycleEvents) {
  return {
    type: 'relationship_operation_execution_result',
    operationId: operation.operationId,
    idempotencyKey: operation.idempotencyKey,
    operationType: operation.operationType,
    relationshipId: operation.relationshipId,
    executionStatus: RELATIONSHIP_OPERATION_EXECUTION_STATUS.complete,
    success: true,
    operation,
    outcome: cloneOutcome(outcome),
    lifecycleEvents,
    metadata: {
      executor: 'relationship-operation-executor',
      adapterMethod
    },
    error: '',
    normalizedError: null
  };
}

function createExecutionError(message, operation, lifecycleEvents, {
  code = 'relationship_operation_execution_error',
  category = 'execution',
  adapterMethod = ''
} = {}) {
  return {
    type: 'relationship_operation_execution_result',
    operationId: operation?.operationId || '',
    idempotencyKey: operation?.idempotencyKey || '',
    operationType: operation?.operationType || '',
    relationshipId: operation?.relationshipId || '',
    executionStatus: RELATIONSHIP_OPERATION_EXECUTION_STATUS.error,
    success: false,
    operation,
    outcome: null,
    lifecycleEvents,
    metadata: {
      executor: 'relationship-operation-executor',
      adapterMethod
    },
    error: message,
    normalizedError: createNormalizedError(code, message, category)
  };
}

function getRuntimeErrorMessage(runtimeOutcome) {
  if (typeof runtimeOutcome?.error === 'string' && runtimeOutcome.error) {
    return runtimeOutcome.error;
  }

  if (typeof runtimeOutcome?.error?.message === 'string' && runtimeOutcome.error.message) {
    return runtimeOutcome.error.message;
  }

  return 'Relationship execution target failed';
}

function isRuntimeError(runtimeOutcome) {
  return runtimeOutcome?.status === 'error' || runtimeOutcome?.success === false;
}

export function createRelationshipOperationExecutor({ runtime, onEvent = null } = {}) {
  function execute(operationInput) {
    const lifecycleEvents = [];

    function emit(phase, operation, detail = {}) {
      const event = createExecutionEvent(phase, operation, detail);

      lifecycleEvents.push(event);

      if (typeof onEvent === 'function') {
        onEvent(event);
      }

      return event;
    }

    emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.received, operationInput);

    const operation = normalizeRelationshipOperation(operationInput);
    const contractValidation = validateRelationshipOperation(operationInput);

    if (!contractValidation.ok) {
      emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error, contractValidation.operation, {
        errors: contractValidation.errors
      });

      return createExecutionError(
        contractValidation.errors[0],
        contractValidation.operation,
        lifecycleEvents,
        {
          code: 'relationship_operation_contract_invalid',
          category: 'contract'
        }
      );
    }

    emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.contractValidated, operation);

    if (operation.validationStatus !== RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid) {
      const message = 'Relationship operation validationStatus must be valid before execution';

      emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error, operation, { message });
      return createExecutionError(message, operation, lifecycleEvents, {
        code: 'relationship_operation_not_executable',
        category: 'precondition'
      });
    }

    const adapterMethod = RUNTIME_METHODS[operation.operationType];

    if (!adapterMethod || !runtime || typeof runtime[adapterMethod] !== 'function') {
      const message = adapterMethod
        ? `Relationship execution target requires ${adapterMethod}()`
        : 'Relationship operation operationType is unsupported';

      emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error, operation, { message });
      return createExecutionError(message, operation, lifecycleEvents, {
        code: 'relationship_operation_precondition_failed',
        category: 'precondition',
        adapterMethod: adapterMethod || ''
      });
    }

    emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.preconditionsValidated, operation, {
      adapterMethod
    });
    emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.dispatched, operation, {
      adapterMethod
    });

    let runtimeOutcome;

    try {
      runtimeOutcome = runtime[adapterMethod](operation);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Relationship execution target threw an unknown error';

      emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error, operation, {
        adapterMethod,
        message
      });
      return createExecutionError(message, operation, lifecycleEvents, {
        code: 'relationship_operation_runtime_failure',
        category: 'runtime',
        adapterMethod
      });
    }

    if (isRuntimeError(runtimeOutcome)) {
      const message = getRuntimeErrorMessage(runtimeOutcome);

      emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error, operation, {
        adapterMethod,
        message
      });
      return createExecutionError(message, operation, lifecycleEvents, {
        code: 'relationship_operation_runtime_failure',
        category: 'runtime',
        adapterMethod
      });
    }

    emit(RELATIONSHIP_OPERATION_EXECUTOR_PHASES.completed, operation, {
      adapterMethod
    });

    return createExecutionResult(
      operation,
      adapterMethod,
      runtimeOutcome,
      lifecycleEvents
    );
  }

  return {
    execute
  };
}
