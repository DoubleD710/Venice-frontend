import {
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS
} from './memory-operation-contracts.js';
import {
  createMemoryOperationProcessor,
  normalizeMemoryOperation,
  validateMemoryOperation
} from './memory-operations.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidOperation(overrides = {}) {
  return {
    operationId: 'operation-1',
    idempotencyKey: 'idem-1',
    operationType: MEMORY_OPERATION_TYPES.put,
    targetMemoryIds: [],
    payload: {
      card: {
        id: 'memory-1'
      }
    },
    proposalMetadata: {
      proposedBy: 'test'
    },
    timestamp: '2026-07-15T00:00:00.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.pending,
    ...overrides
  };
}

export function runMemoryOperationTests() {
  const processor = createMemoryOperationProcessor();
  const events = [];

  processor.onEvent((event) => {
    events.push(event);
  });

  const valid = processor.propose(createValidOperation());
  const normalized = normalizeMemoryOperation(createValidOperation({
    operationId: 'operation-2',
    targetMemoryIds: 'memory-2'
  }));
  const malformed = validateMemoryOperation(null);
  const missingFields = processor.propose({
    operationId: '',
    operationType: MEMORY_OPERATION_TYPES.update,
    targetMemoryIds: [],
    payload: {},
    proposalMetadata: {},
    timestamp: '',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.pending
  });
  const invalidType = processor.propose(createValidOperation({
    operationId: 'operation-3',
    operationType: 'unknown'
  }));
  const invalidMergePolicy = processor.propose(createValidOperation({
    operationId: 'operation-invalid-merge-policy',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['memory-1', 'memory-2'],
    mergePolicy: 'argument_order_wins'
  }));
  const merge = processor.propose(createValidOperation({
    operationId: 'operation-4',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['memory-1', 'memory-2'],
    mergePolicy: 'target_wins',
    payload: {
      mergedMemoryId: 'memory-1'
    }
  }));
  const deleteOperation = processor.propose(createValidOperation({
    operationId: 'operation-5',
    operationType: MEMORY_OPERATION_TYPES.delete,
    targetMemoryIds: ['memory-1'],
    payload: {}
  }));
  const expireOperation = processor.propose(createValidOperation({
    operationId: 'operation-6',
    operationType: MEMORY_OPERATION_TYPES.expire,
    targetMemoryIds: ['memory-1'],
    payload: {
      reason: 'stale'
    }
  }));

  return [
    assert('valid operations', valid.status === 'valid' && valid.operation.validationStatus === 'valid'),
    assert('malformed operations', !malformed.ok && malformed.errors[0] === 'Memory operation must be an object'),
    assert('missing fields', missingFields.status === 'invalid' && missingFields.error === 'Memory operation operationId is required'),
    assert('invalid operation types', invalidType.status === 'invalid' && invalidType.error === 'Memory operation operationType is invalid'),
    assert('invalid merge policy syntax', invalidMergePolicy.status === 'invalid' && invalidMergePolicy.error === 'Memory operation mergePolicy is invalid'),
    assert('normalization', normalized.targetMemoryIds.length === 1 && normalized.targetMemoryIds[0] === 'memory-2'),
    assert('operation identity preservation', valid.operation.operationId === 'operation-1' && valid.operation.idempotencyKey === 'idem-1'),
    assert('merge operation validation', merge.status === 'valid' && merge.operation.targetMemoryIds.length === 2),
    assert('delete operation validation', deleteOperation.status === 'valid'),
    assert('expire operation validation', expireOperation.status === 'valid'),
    assert('lifecycle events', events.some((event) => event.phase === 'validated') && events.some((event) => event.phase === 'rejected')),
    assert('normalized errors', missingFields.type === 'memory_operation_result' && Array.isArray(missingFields.errors))
  ];
}
