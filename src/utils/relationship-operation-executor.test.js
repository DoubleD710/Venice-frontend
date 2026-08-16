import {
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import {
  createRelationshipOperationExecutor,
  RELATIONSHIP_OPERATION_EXECUTION_STATUS,
  RELATIONSHIP_OPERATION_EXECUTOR_PHASES
} from './relationship-operation-executor.js';
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES
} from './relationship-types.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createRelationship(overrides = {}) {
  return {
    relationshipId: 'relationship-1',
    sourceMemoryId: 'memory-source-1',
    targetMemoryId: 'memory-target-1',
    relationshipType: RELATIONSHIP_TYPES.supports,
    confidence: 0.75,
    provenance: {
      source: 'relationship-executor-test'
    },
    metadata: {},
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    status: RELATIONSHIP_STATUS.active,
    ...overrides
  };
}

function createOperation(operationType, overrides = {}) {
  const relationshipId = overrides.relationshipId || 'relationship-1';
  let payload = {};

  if (operationType === RELATIONSHIP_OPERATION_TYPES.link) {
    payload = {
      relationship: createRelationship({ relationshipId })
    };
  }

  if ([
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    RELATIONSHIP_OPERATION_TYPES.weaken
  ].includes(operationType)) {
    payload = {
      confidenceDelta: 0.1
    };
  }

  return {
    operationId: `operation-${operationType}`,
    idempotencyKey: `idempotency-${operationType}`,
    operationType,
    relationshipId,
    payload,
    proposalMetadata: {
      proposedBy: 'test'
    },
    provenance: {
      source: 'relationship-executor-test'
    },
    timestamp: '2026-08-16T00:00:01.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid,
    ...overrides
  };
}

function createExecutionTarget({ failMethod = '', throwMethod = '' } = {}) {
  const calls = {
    linkRelationship: 0,
    unlinkRelationship: 0,
    strengthenRelationship: 0,
    weakenRelationship: 0,
    neighbors: 0,
    traverse: 0,
    inferRelationships: 0
  };

  function run(method, operation) {
    calls[method] += 1;

    if (method === throwMethod) {
      throw new Error('Injected relationship target failure');
    }

    if (method === failMethod) {
      return {
        status: 'error',
        error: 'Injected relationship target rejection'
      };
    }

    return {
      status: 'complete',
      appliedOperation: operation.operationType,
      relationshipId: operation.relationshipId
    };
  }

  return {
    calls,
    target: {
      linkRelationship(operation) {
        return run('linkRelationship', operation);
      },
      unlinkRelationship(operation) {
        return run('unlinkRelationship', operation);
      },
      strengthenRelationship(operation) {
        return run('strengthenRelationship', operation);
      },
      weakenRelationship(operation) {
        return run('weakenRelationship', operation);
      },
      neighbors() {
        calls.neighbors += 1;
      },
      traverse() {
        calls.traverse += 1;
      },
      inferRelationships() {
        calls.inferRelationships += 1;
      }
    }
  };
}

function executeWithFreshTarget(operation) {
  const fixture = createExecutionTarget();
  const executor = createRelationshipOperationExecutor({ runtime: fixture.target });

  return executor.execute(operation);
}

export function runRelationshipOperationExecutorTests() {
  const fixture = createExecutionTarget();
  const events = [];
  const executor = createRelationshipOperationExecutor({
    runtime: fixture.target,
    onEvent(event) {
      events.push(event);
    }
  });

  const link = executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const unlink = executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink));
  const strengthen = executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.strengthen));
  const weaken = executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.weaken));

  const callsBeforeInvalid = JSON.stringify(fixture.calls);
  const contractInvalid = executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.unlink,
    { relationshipId: '' }
  ));
  const unsupported = executor.execute(createOperation('neighbors'));
  const pending = executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    { validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.pending }
  ));
  const callsAfterInvalid = JSON.stringify(fixture.calls);

  const missingCapabilityFixture = createExecutionTarget();
  delete missingCapabilityFixture.target.strengthenRelationship;
  const missingCapability = createRelationshipOperationExecutor({
    runtime: missingCapabilityFixture.target
  }).execute(createOperation(RELATIONSHIP_OPERATION_TYPES.strengthen));

  const failureFixture = createExecutionTarget({
    failMethod: 'unlinkRelationship'
  });
  const runtimeFailure = createRelationshipOperationExecutor({
    runtime: failureFixture.target
  }).execute(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink));

  const thrownFixture = createExecutionTarget({
    throwMethod: 'weakenRelationship'
  });
  const thrownFailure = createRelationshipOperationExecutor({
    runtime: thrownFixture.target
  }).execute(createOperation(RELATIONSHIP_OPERATION_TYPES.weaken));

  const identity = executeWithFreshTarget(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    {
      operationId: 'operation-preserved',
      idempotencyKey: 'idempotency-preserved'
    }
  ));
  const deterministicOperation = createOperation(RELATIONSHIP_OPERATION_TYPES.strengthen, {
    operationId: 'operation-deterministic',
    idempotencyKey: 'idempotency-deterministic'
  });
  const deterministicA = executeWithFreshTarget(deterministicOperation);
  const deterministicB = executeWithFreshTarget(deterministicOperation);
  const executorSurface = Object.keys(createRelationshipOperationExecutor({
    runtime: createExecutionTarget().target
  }));
  const inputOperation = createOperation(RELATIONSHIP_OPERATION_TYPES.link);
  const inputBefore = JSON.stringify(inputOperation);

  executeWithFreshTarget(inputOperation);

  const acceptedCallCount = fixture.calls.linkRelationship
    + fixture.calls.unlinkRelationship
    + fixture.calls.strengthenRelationship
    + fixture.calls.weakenRelationship;
  const queryCallCount = fixture.calls.neighbors
    + fixture.calls.traverse
    + fixture.calls.inferRelationships;

  return [
    assert('valid link dispatch', link.executionStatus === 'complete' && fixture.calls.linkRelationship === 1),
    assert('valid unlink dispatch', unlink.executionStatus === 'complete' && fixture.calls.unlinkRelationship === 1),
    assert('valid strengthen dispatch', strengthen.executionStatus === 'complete' && fixture.calls.strengthenRelationship === 1),
    assert('valid weaken dispatch', weaken.executionStatus === 'complete' && fixture.calls.weakenRelationship === 1),
    assert('contract-invalid operation rejected before dispatch', contractInvalid.executionStatus === 'error' && contractInvalid.normalizedError.category === 'contract' && callsBeforeInvalid === callsAfterInvalid),
    assert('unsupported operation rejected', unsupported.executionStatus === 'error' && unsupported.error === 'Relationship operation operationType is invalid'),
    assert('invalid validation state rejected', pending.executionStatus === 'error' && pending.normalizedError.code === 'relationship_operation_not_executable'),
    assert('missing runtime capability rejected', missingCapability.executionStatus === 'error' && missingCapability.error === 'Relationship execution target requires strengthenRelationship()' && missingCapabilityFixture.calls.strengthenRelationship === 0),
    assert('runtime adapter failure normalized', runtimeFailure.executionStatus === 'error' && runtimeFailure.normalizedError.category === 'runtime' && failureFixture.calls.unlinkRelationship === 1),
    assert('thrown runtime adapter failure normalized', thrownFailure.executionStatus === 'error' && thrownFailure.error === 'Injected relationship target failure' && thrownFixture.calls.weakenRelationship === 1),
    assert('operationId preserved', identity.operationId === 'operation-preserved' && identity.lifecycleEvents.every((event) => event.operationId === 'operation-preserved')),
    assert('idempotencyKey preserved', identity.idempotencyKey === 'idempotency-preserved' && identity.lifecycleEvents.every((event) => event.idempotencyKey === 'idempotency-preserved')),
    assert('deterministic result for identical inputs', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('executor owns no state surface', executorSurface.length === 1 && executorSurface[0] === 'execute'),
    assert('executor creates no graph', !executorSurface.includes('graph') && !executorSurface.includes('relationships')),
    assert('executor does not traverse', queryCallCount === 0),
    assert('executor does not infer relationships', fixture.calls.inferRelationships === 0),
    assert('accepted operations dispatch exactly once', acceptedCallCount === 4),
    assert('rejected operations never dispatch', callsBeforeInvalid === callsAfterInvalid),
    assert('input operation remains immutable', JSON.stringify(inputOperation) === inputBefore),
    assert('normalized execution result', link.type === 'relationship_operation_execution_result' && link.success && link.outcome.appliedOperation === 'link'),
    assert('normalized execution error', runtimeFailure.type === 'relationship_operation_execution_result' && !runtimeFailure.success && runtimeFailure.outcome === null),
    assert('lifecycle events emitted', events.some((event) => event.phase === RELATIONSHIP_OPERATION_EXECUTOR_PHASES.dispatched) && events.some((event) => event.phase === RELATIONSHIP_OPERATION_EXECUTOR_PHASES.error)),
    assert('execution status constants used', link.executionStatus === RELATIONSHIP_OPERATION_EXECUTION_STATUS.complete && runtimeFailure.executionStatus === RELATIONSHIP_OPERATION_EXECUTION_STATUS.error)
  ];
}
