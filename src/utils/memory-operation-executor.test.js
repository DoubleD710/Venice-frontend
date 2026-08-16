import { createMemoryRuntime } from './memory-runtime.js';
import { createMemoryOperationExecutor } from './memory-operation-executor.js';
import {
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS
} from './memory-operation-contracts.js';
import { createMemoryOperationProcessor } from './memory-operations.js';
import { MEMORY_TYPES } from './memory-types.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createCandidate(id, evidence = 'Evidence') {
  return {
    id,
    source: `session:${id}`,
    category: MEMORY_TYPES.preference,
    confidence: 0.8,
    evidence: [evidence],
    metadata: {
      turnId: id
    }
  };
}

function createOperation(overrides = {}) {
  return {
    operationId: 'operation-1',
    idempotencyKey: 'idempotency-1',
    operationType: MEMORY_OPERATION_TYPES.put,
    targetMemoryIds: [],
    payload: {
      candidate: createCandidate('candidate-1'),
      card: {
        id: 'card-1',
        summary: 'User prefers local-first systems.',
        tags: ['local-first']
      }
    },
    proposalMetadata: {
      proposedBy: 'test'
    },
    timestamp: '2026-08-13T00:00:00.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid,
    ...overrides
  };
}

function runPut(runtime, operation = createOperation()) {
  const executor = createMemoryOperationExecutor({ runtime });

  return executor.execute(operation);
}

export function runMemoryOperationExecutorTests() {
  const runtime = createMemoryRuntime();
  const executor = createMemoryOperationExecutor({ runtime });
  const events = [];

  executor.onEvent((event) => {
    events.push(event);
  });

  const proposalRuntime = createMemoryRuntime();
  const operationProcessor = createMemoryOperationProcessor();
  const inertProposal = operationProcessor.propose(createOperation({
    operationId: 'operation-inert',
    payload: {
      candidate: createCandidate('candidate-inert'),
      card: {
        id: 'card-inert',
        summary: 'Inert proposal'
      }
    }
  }));
  const stateBeforeDispatch = proposalRuntime.getDiagnostics().cardCount;

  const put = executor.execute(createOperation());
  const stateAfterPut = runtime.getDiagnostics().cardCount;
  const update = executor.execute(createOperation({
    operationId: 'operation-2',
    operationType: MEMORY_OPERATION_TYPES.update,
    targetMemoryIds: ['card-1'],
    payload: {
      updates: {
        summary: 'Updated deterministic memory card.',
        tags: ['local-first', 'updated']
      }
    }
  }));
  const expire = executor.execute(createOperation({
    operationId: 'operation-3',
    operationType: MEMORY_OPERATION_TYPES.expire,
    targetMemoryIds: ['card-1'],
    payload: {
      expiration: {
        expiresAt: '2026-08-14T00:00:00.000Z',
        reason: 'test-expire'
      }
    }
  }));
  const expiredStillPresent = runtime.getCard('card-1');
  const repeatedExpire = executor.execute(createOperation({
    operationId: 'operation-3-repeat',
    operationType: MEMORY_OPERATION_TYPES.expire,
    targetMemoryIds: ['card-1'],
    payload: {
      expiration: {
        expiresAt: '2026-08-14T00:00:00.000Z',
        reason: 'repeat-expire'
      }
    }
  }));
  const deleted = executor.execute(createOperation({
    operationId: 'operation-4',
    operationType: MEMORY_OPERATION_TYPES.delete,
    targetMemoryIds: ['card-1'],
    payload: {}
  }));
  const deletedActiveCard = runtime.getCard('card-1');

  const mergeRuntime = createMemoryRuntime();
  const mergeExecutor = createMemoryOperationExecutor({ runtime: mergeRuntime });

  mergeExecutor.execute(createOperation({
    operationId: 'operation-merge-put-1',
    payload: {
      candidate: createCandidate('candidate-merge-1', 'First merge evidence'),
      card: {
        id: 'merge-card-1',
        summary: 'Merge primary',
        tags: ['primary']
      }
    }
  }));
  mergeExecutor.execute(createOperation({
    operationId: 'operation-merge-put-2',
    payload: {
      candidate: createCandidate('candidate-merge-2', 'Second merge evidence'),
      card: {
        id: 'merge-card-2',
        summary: 'Merge secondary',
        tags: ['secondary']
      }
    }
  }));
  const merged = mergeExecutor.execute(createOperation({
    operationId: 'operation-merge',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['merge-card-1', 'merge-card-2'],
    mergePolicy: 'target_wins',
    payload: {}
  }));

  const missingMergePolicy = mergeExecutor.execute(createOperation({
    operationId: 'operation-missing-merge-policy',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['merge-card-1', 'merge-card-2'],
    mergePolicy: '',
    payload: {}
  }));
  const unsupportedMergePolicy = mergeExecutor.execute(createOperation({
    operationId: 'operation-unsupported-merge-policy',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['merge-card-1', 'merge-card-2'],
    mergePolicy: 'source_wins',
    payload: {}
  }));
  const mergePayloadOverride = mergeExecutor.execute(createOperation({
    operationId: 'operation-merge-payload-override',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['merge-card-1', 'merge-card-2'],
    mergePolicy: 'target_wins',
    payload: {
      card: {
        summary: 'Caller override should not run'
      }
    }
  }));
  const mergeMissingTarget = mergeExecutor.execute(createOperation({
    operationId: 'operation-merge-missing-target',
    operationType: MEMORY_OPERATION_TYPES.merge,
    targetMemoryIds: ['merge-card-1', 'missing-merge-card'],
    mergePolicy: 'target_wins',
    payload: {}
  }));

  const malformed = executor.execute(null);
  const unsupported = executor.execute(createOperation({
    operationId: 'operation-unsupported',
    operationType: 'link'
  }));
  const invalidStatus = executor.execute(createOperation({
    operationId: 'operation-invalid-status',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.pending
  }));
  const runtimeFailure = executor.execute(createOperation({
    operationId: 'operation-runtime-failure',
    operationType: MEMORY_OPERATION_TYPES.delete,
    targetMemoryIds: ['missing-card'],
    payload: {}
  }));
  const updateMissing = executor.execute(createOperation({
    operationId: 'operation-update-missing',
    operationType: MEMORY_OPERATION_TYPES.update,
    targetMemoryIds: ['missing-card'],
    payload: {
      updates: {
        summary: 'No upsert'
      }
    }
  }));
  const repeatedDelete = executor.execute(createOperation({
    operationId: 'operation-repeated-delete',
    operationType: MEMORY_OPERATION_TYPES.delete,
    targetMemoryIds: ['card-1'],
    payload: {}
  }));
  const stateAfterFailedOperations = runtime.getDiagnostics().cardCount;

  const inputOperation = createOperation({
    operationId: 'operation-immutable',
    payload: {
      candidate: createCandidate('candidate-immutable'),
      card: {
        id: 'card-immutable',
        summary: 'Immutable input',
        tags: ['immutable']
      }
    }
  });
  const inputBefore = JSON.stringify(inputOperation);
  const immutableRuntime = createMemoryRuntime();
  const immutableExecutor = createMemoryOperationExecutor({ runtime: immutableRuntime });
  const immutableResult = immutableExecutor.execute(inputOperation);
  const previousSnapshotRuntime = createMemoryRuntime();
  const previousSnapshotExecutor = createMemoryOperationExecutor({ runtime: previousSnapshotRuntime });
  previousSnapshotExecutor.execute(createOperation({
    operationId: 'operation-previous-snapshot-put',
    payload: {
      candidate: createCandidate('candidate-previous-snapshot'),
      card: {
        id: 'card-previous-snapshot',
        summary: 'Previous snapshot',
        tags: ['previous']
      }
    }
  }));
  const previousSnapshotUpdate = previousSnapshotExecutor.execute(createOperation({
    operationId: 'operation-previous-snapshot-update',
    operationType: MEMORY_OPERATION_TYPES.update,
    targetMemoryIds: ['card-previous-snapshot'],
    payload: {
      updates: {
        summary: 'Updated previous snapshot'
      }
    }
  }));
  previousSnapshotUpdate.previousState.tags.push('mutated-previous');
  const previousSnapshotCard = previousSnapshotRuntime.getCard('card-previous-snapshot');
  immutableResult.resultingState.tags.push('mutated-snapshot');
  const immutableRuntimeCard = immutableRuntime.getCard('card-immutable');
  const listedCards = immutableRuntime.listCards();
  listedCards[0].tags.push('mutated-list-snapshot');
  const immutableRuntimeCardAfterListMutation = immutableRuntime.getCard('card-immutable');

  const noIdempotency = executor.execute(createOperation({
    operationId: 'operation-no-idempotency',
    idempotencyKey: '',
    operationType: MEMORY_OPERATION_TYPES.put,
    payload: {
      candidate: createCandidate('candidate-no-idempotency'),
      card: {
        id: 'card-no-idempotency',
        summary: 'No idempotency key'
      }
    }
  }));
  const duplicateIdentityRuntime = createMemoryRuntime();
  const duplicateIdentityExecutor = createMemoryOperationExecutor({ runtime: duplicateIdentityRuntime });
  const duplicateIdentityA = duplicateIdentityExecutor.execute(createOperation({
    operationId: 'duplicate-operation-id',
    idempotencyKey: 'duplicate-idempotency-key',
    payload: {
      candidate: createCandidate('candidate-duplicate-a'),
      card: {
        id: 'card-duplicate-a',
        summary: 'Duplicate operation id A'
      }
    }
  }));
  const duplicateIdentityB = duplicateIdentityExecutor.execute(createOperation({
    operationId: 'duplicate-operation-id',
    idempotencyKey: 'duplicate-idempotency-key',
    payload: {
      candidate: createCandidate('candidate-duplicate-b'),
      card: {
        id: 'card-duplicate-b',
        summary: 'Duplicate operation id B'
      }
    }
  }));

  const deterministicA = runPut(createMemoryRuntime(), createOperation({
    operationId: 'operation-deterministic'
  }));
  const deterministicB = runPut(createMemoryRuntime(), createOperation({
    operationId: 'operation-deterministic'
  }));
  const executorDiagnostics = executor.getDiagnostics();

  return [
    assert('identical state and operation produce identical result', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('valid put', put.status === 'complete' && put.runtimeResult.card.id === 'card-1'),
    assert('valid update', update.status === 'complete' && update.runtimeResult.card.summary === 'Updated deterministic memory card.'),
    assert('valid expire', expire.status === 'complete' && expire.runtimeResult.card.lifecycleState === 'archived' && expiredStillPresent !== null),
    assert('repeat expire remains soft', repeatedExpire.status === 'complete' && repeatedExpire.resultingState.metadata.lifecycle.lastTransition.expiration.reason === 'repeat-expire'),
    assert('valid delete', deleted.status === 'complete' && deleted.runtimeResult.card.lifecycleState === 'deleted' && deletedActiveCard === null),
    assert('valid merge', merged.status === 'complete' && merged.runtimeResult.card.tags.includes('primary') && !merged.runtimeResult.card.tags.includes('secondary')),
    assert('missing merge policy rejected', missingMergePolicy.status === 'error' && missingMergePolicy.error === 'Merge memory operation requires mergePolicy'),
    assert('unsupported merge policy rejected', unsupportedMergePolicy.status === 'error' && unsupportedMergePolicy.error === 'Unsupported memory mergePolicy: source_wins'),
    assert('merge payload override rejected', mergePayloadOverride.status === 'error' && mergePayloadOverride.error === 'Merge memory operation does not support payload.card in v0.1'),
    assert('merge missing source or target rejected', mergeMissingTarget.status === 'error' && mergeMissingTarget.error === 'Both memory cards are required for merge'),
    assert('deterministic merge conflict behavior', merged.resultingState[0].summary === 'Merge primary' && merged.resultingState[1].lifecycleState === 'merged'),
    assert('malformed operation rejected', malformed.status === 'error' && malformed.error === 'Memory operation must be an object'),
    assert('unsupported operation rejected', unsupported.status === 'error' && unsupported.error === 'Memory operation operationType is invalid'),
    assert('invalid validation status rejected', invalidStatus.status === 'error' && invalidStatus.error === 'Memory operation validationStatus must be valid before execution'),
    assert('runtime failure normalized', runtimeFailure.status === 'error' && runtimeFailure.error === 'Memory card was not found'),
    assert('update missing is not upsert', updateMissing.status === 'error' && updateMissing.error === 'Memory card was not found'),
    assert('repeated delete fails precondition', repeatedDelete.status === 'error' && repeatedDelete.error === 'Memory card was not found'),
    assert('failed operation leaves state unchanged', stateAfterFailedOperations === 0),
    assert('lifecycle event emission', events.some((event) => event.phase === 'executor_completed') && events.some((event) => event.phase === 'executor_error')),
    assert('state changes only after executor dispatch', inertProposal.status === 'valid' && stateBeforeDispatch === 0 && stateAfterPut === 1),
    assert('executor contains no memory store diagnostics', !Object.prototype.hasOwnProperty.call(executorDiagnostics, 'cardCount')),
    assert('executor delegates mutations to Memory Runtime', runtime.getCard('card-1') === null),
    assert('operationId preservation', put.operationId === 'operation-1' && put.lifecycleEvents.every((event) => event.operationId === 'operation-1')),
    assert('idempotencyKey preservation', put.idempotencyKey === 'idempotency-1' && put.lifecycleEvents.every((event) => event.idempotencyKey === 'idempotency-1')),
    assert('missing optional idempotencyKey', noIdempotency.status === 'complete' && noIdempotency.idempotencyKey === ''),
    assert('input object immutability', JSON.stringify(inputOperation) === inputBefore),
    assert('previous-state snapshot immutability', !previousSnapshotCard.tags.includes('mutated-previous')),
    assert('resulting-state snapshot immutability', !immutableRuntimeCard.tags.includes('mutated-snapshot')),
    assert('listCards snapshot immutability', !immutableRuntimeCardAfterListMutation.tags.includes('mutated-list-snapshot')),
    assert('normalized result shape', ['operationId', 'idempotencyKey', 'operationType', 'success', 'previousState', 'resultingState', 'lifecycleEvents', 'normalizedError'].every((key) => Object.prototype.hasOwnProperty.call(put, key))),
    assert('deterministic errors', JSON.stringify(updateMissing.normalizedError) === JSON.stringify(repeatedDelete.normalizedError)),
    assert('duplicate operationId does not dedupe', duplicateIdentityA.status === 'complete' && duplicateIdentityB.status === 'complete' && duplicateIdentityRuntime.getDiagnostics().cardCount === 2),
    assert('duplicate idempotencyKey does not suppress replay', duplicateIdentityA.idempotencyKey === duplicateIdentityB.idempotencyKey && duplicateIdentityRuntime.getCard('card-duplicate-b') !== null),
    assert('error result includes lifecycle events', updateMissing.lifecycleEvents.some((event) => event.phase === 'executor_error'))
  ];
}
