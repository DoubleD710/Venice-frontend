import {
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import { createRelationshipOperationExecutor } from './relationship-operation-executor.js';
import {
  createRelationshipRuntime,
  RELATIONSHIP_RUNTIME_PHASES
} from './relationship-runtime.js';
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
    confidence: 0.5,
    provenance: {
      source: 'relationship-runtime-test'
    },
    metadata: {
      nested: {
        stable: true
      }
    },
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    status: RELATIONSHIP_STATUS.candidate,
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
      source: 'relationship-runtime-test'
    },
    timestamp: '2026-08-16T00:00:01.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid,
    ...overrides
  };
}

function createHarness(onEvent = null) {
  const runtime = createRelationshipRuntime({ onEvent });
  const executor = createRelationshipOperationExecutor({ runtime });

  return {
    runtime,
    executor
  };
}

export function runRelationshipRuntimeTests() {
  const events = [];
  const harness = createHarness((event) => events.push(event));
  const linkOperation = createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    operationId: 'operation-link-preserved',
    idempotencyKey: 'idempotency-link-preserved'
  });
  const link = harness.executor.execute(linkOperation);
  const linkedState = harness.runtime.getRelationship('relationship-1');
  const duplicate = harness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    operationId: 'operation-link-duplicate'
  }));
  const structuralDuplicate = harness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    operationId: 'operation-link-structural-duplicate',
    relationshipId: 'relationship-structural-duplicate',
    payload: {
      relationship: createRelationship({
        relationshipId: 'relationship-structural-duplicate'
      })
    }
  }));
  const stateAfterDuplicates = harness.runtime.listRelationships();
  harness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.strengthen, {
    operationId: 'operation-event-strengthen'
  }));
  harness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.weaken, {
    operationId: 'operation-event-weaken'
  }));
  harness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink, {
    operationId: 'operation-event-unlink'
  }));

  const invalidHarness = createHarness();
  const invalidRelationship = invalidHarness.executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    {
      payload: {
        relationship: createRelationship({ confidence: 1.5 })
      }
    }
  ));
  const archivedRelationship = invalidHarness.executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    {
      operationId: 'operation-link-archived',
      payload: {
        relationship: createRelationship({ status: RELATIONSHIP_STATUS.archived })
      }
    }
  ));

  const unlinkHarness = createHarness();
  unlinkHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const unlink = unlinkHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink));
  const stateAfterUnlink = unlinkHarness.runtime.getRelationship('relationship-1');
  const missingUnlink = unlinkHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink, {
    operationId: 'operation-unlink-missing'
  }));

  const strengthenHarness = createHarness();
  strengthenHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    payload: {
      relationship: createRelationship({ confidence: 0.95 })
    }
  }));
  const strengthen = strengthenHarness.executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    { payload: { confidenceDelta: 0.1 } }
  ));
  const strengthenedState = strengthenHarness.runtime.getRelationship('relationship-1');
  const missingStrengthen = createHarness().executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.strengthen
  ));

  const weakenHarness = createHarness();
  weakenHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    payload: {
      relationship: createRelationship({ confidence: 0.05 })
    }
  }));
  const weaken = weakenHarness.executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.weaken,
    { payload: { confidenceDelta: 0.1 } }
  ));
  const weakenedState = weakenHarness.runtime.getRelationship('relationship-1');
  const missingWeaken = createHarness().executor.execute(createOperation(
    RELATIONSHIP_OPERATION_TYPES.weaken
  ));

  const invalidAdjustment = strengthenHarness.runtime.strengthenRelationship(createOperation(
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    { payload: { confidenceDelta: 0 } }
  ));

  const snapshotHarness = createHarness();
  snapshotHarness.executor.execute(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const returnedSnapshot = snapshotHarness.runtime.getRelationship('relationship-1');
  returnedSnapshot.confidence = 0;
  returnedSnapshot.metadata.nested.stable = false;
  const stateAfterSnapshotMutation = snapshotHarness.runtime.getRelationship('relationship-1');
  const returnedList = snapshotHarness.runtime.listRelationships();
  returnedList[0].confidence = 0;
  returnedList[0].metadata.nested.stable = false;
  returnedList.push(createRelationship({ relationshipId: 'injected' }));
  const stateAfterListMutation = snapshotHarness.runtime.getRelationship('relationship-1');
  const listAfterMutation = snapshotHarness.runtime.listRelationships();

  const isolatedRuntime = createRelationshipRuntime();
  const isolatedState = isolatedRuntime.listRelationships();

  const deterministicOperation = createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    operationId: 'operation-deterministic',
    idempotencyKey: 'idempotency-deterministic'
  });
  const deterministicA = createHarness().executor.execute(deterministicOperation);
  const deterministicB = createHarness().executor.execute(deterministicOperation);

  const directErrorEvents = [];
  const directErrorRuntime = createRelationshipRuntime({
    onEvent(event) {
      directErrorEvents.push(event);
    }
  });
  const cyclicRelationship = createRelationship();
  cyclicRelationship.metadata.self = cyclicRelationship.metadata;
  const runtimeError = directErrorRuntime.linkRelationship(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    {
      payload: {
        relationship: cyclicRelationship
      }
    }
  ));

  const memoryState = [{ id: 'memory-source-1', value: 'unchanged' }];
  const memoryStateBefore = JSON.stringify(memoryState);

  return [
    assert('valid link through executor', link.executionStatus === 'complete' && linkedState.status === RELATIONSHIP_STATUS.active),
    assert('duplicate relationshipId rejected', duplicate.executionStatus === 'error' && duplicate.error === 'Relationship already exists'),
    assert('structural duplicate rejected', structuralDuplicate.executionStatus === 'error' && structuralDuplicate.error === 'Relationship already exists' && stateAfterDuplicates.length === 1),
    assert('invalid relationship rejected', invalidRelationship.executionStatus === 'error' && invalidHarness.runtime.listRelationships().length === 0),
    assert('invalid link lifecycle rejected', archivedRelationship.executionStatus === 'error' && archivedRelationship.error === 'Archived or deleted relationships cannot be linked'),
    assert('link operationId preserved', link.operationId === 'operation-link-preserved' && link.outcome.operationId === 'operation-link-preserved'),
    assert('link idempotencyKey preserved', link.idempotencyKey === 'idempotency-link-preserved' && link.outcome.idempotencyKey === 'idempotency-link-preserved'),
    assert('valid unlink through executor', unlink.executionStatus === 'complete' && unlink.outcome.removed),
    assert('unlink changes state', stateAfterUnlink === null),
    assert('missing unlink rejected', missingUnlink.executionStatus === 'error' && missingUnlink.error === 'Relationship was not found'),
    assert('valid strengthen through executor', strengthen.executionStatus === 'complete' && strengthen.outcome.previousConfidence === 0.95),
    assert('strengthen saturates at upper bound', strengthenedState.confidence === 1),
    assert('missing strengthen rejected', missingStrengthen.executionStatus === 'error' && missingStrengthen.error === 'Relationship was not found'),
    assert('valid weaken through executor', weaken.executionStatus === 'complete' && weaken.outcome.previousConfidence === 0.05),
    assert('weaken saturates at lower bound', weakenedState.confidence === 0),
    assert('missing weaken rejected', missingWeaken.executionStatus === 'error' && missingWeaken.error === 'Relationship was not found'),
    assert('invalid adjustment rejected by runtime', invalidAdjustment.status === 'error' && invalidAdjustment.normalizedError.code === 'relationship_runtime_invalid_adjustment'),
    assert('getRelationship returns defensive snapshot', stateAfterSnapshotMutation.confidence === 0.5 && stateAfterSnapshotMutation.metadata.nested.stable),
    assert('listRelationships returns defensive snapshots', stateAfterListMutation.confidence === 0.5 && stateAfterListMutation.metadata.nested.stable && listAfterMutation.length === 1),
    assert('runtime state isolation', isolatedState.length === 0 && snapshotHarness.runtime.listRelationships().length === 1),
    assert('identical state and operation are deterministic', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('relationship lifecycle events emitted', [
      RELATIONSHIP_RUNTIME_PHASES.linked,
      RELATIONSHIP_RUNTIME_PHASES.unlinked,
      RELATIONSHIP_RUNTIME_PHASES.strengthened,
      RELATIONSHIP_RUNTIME_PHASES.weakened,
      RELATIONSHIP_RUNTIME_PHASES.rejected
    ].every((phase) => events.some((event) => event.phase === phase))),
    assert('relationship runtime error event emitted', runtimeError.status === 'error' && directErrorEvents.some((event) => event.phase === RELATIONSHIP_RUNTIME_PHASES.error)),
    assert('Memory Runtime state remains untouched', JSON.stringify(memoryState) === memoryStateBefore),
    assert('runtime exposes only mutation and read boundaries', Object.keys(harness.runtime).sort().join(',') === ['getRelationship', 'linkRelationship', 'listRelationships', 'strengthenRelationship', 'unlinkRelationship', 'weakenRelationship'].sort().join(','))
  ];
}
