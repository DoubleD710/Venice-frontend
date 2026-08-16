import {
  RELATIONSHIP_OPERATION_PHASES,
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import {
  normalizeRelationshipOperation,
  proposeRelationshipOperation,
  validateRelationshipOperation
} from './relationship-operations.js';
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
      source: 'relationship-operation-test'
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
      source: 'relationship-operation-test'
    },
    timestamp: '2026-08-16T00:00:01.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.pending,
    ...overrides
  };
}

export function runRelationshipOperationTests() {
  const link = proposeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const unlink = proposeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.unlink));
  const strengthen = proposeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.strengthen));
  const weaken = proposeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.weaken));
  const unsupported = proposeRelationshipOperation(createOperation('neighbors'));
  const malformed = validateRelationshipOperation(null);
  const missingIdentifiers = proposeRelationshipOperation(createOperation(
    RELATIONSHIP_OPERATION_TYPES.unlink,
    { operationId: '', relationshipId: '' }
  ));
  const invalidRelationship = proposeRelationshipOperation(createOperation(
    RELATIONSHIP_OPERATION_TYPES.link,
    {
      payload: {
        relationship: createRelationship({ confidence: 1.4 })
      }
    }
  ));
  const invalidAdjustment = proposeRelationshipOperation(createOperation(
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    { payload: { confidenceDelta: 0 } }
  ));
  const invalidPayloadShape = proposeRelationshipOperation(createOperation(
    RELATIONSHIP_OPERATION_TYPES.unlink,
    { payload: [] }
  ));
  const identityInput = createOperation(RELATIONSHIP_OPERATION_TYPES.unlink, {
    operationId: 'operation-preserved',
    idempotencyKey: 'idempotency-preserved'
  });
  const identity = normalizeRelationshipOperation(identityInput);
  const deterministicA = normalizeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const deterministicB = normalizeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.link));
  const deterministicErrorA = validateRelationshipOperation({});
  const deterministicErrorB = validateRelationshipOperation({});
  const events = [];
  const eventResult = proposeRelationshipOperation(
    createOperation(RELATIONSHIP_OPERATION_TYPES.weaken),
    (event) => events.push(event)
  );
  const rejectedEvents = [];
  proposeRelationshipOperation(
    createOperation('traverse'),
    (event) => rejectedEvents.push(event)
  );

  const relationshipInput = createRelationship();
  const relationshipBefore = JSON.stringify(relationshipInput);
  const memoryState = [{ id: 'memory-source-1', value: 'unchanged' }];
  const memoryBefore = JSON.stringify(memoryState);

  proposeRelationshipOperation(createOperation(RELATIONSHIP_OPERATION_TYPES.link, {
    payload: { relationship: relationshipInput }
  }));

  return [
    assert('valid link', link.status === 'valid' && link.operation.operationType === 'link'),
    assert('valid unlink', unlink.status === 'valid' && unlink.operation.operationType === 'unlink'),
    assert('valid strengthen', strengthen.status === 'valid' && strengthen.operation.payload.confidenceDelta === 0.1),
    assert('valid weaken', weaken.status === 'valid' && weaken.operation.payload.confidenceDelta === 0.1),
    assert('unsupported operation', unsupported.status === 'invalid' && unsupported.error === 'Relationship operation operationType is invalid'),
    assert('malformed operation', !malformed.ok && malformed.errors[0] === 'Relationship operation must be an object'),
    assert('missing required identifiers', missingIdentifiers.errors[0] === 'Relationship operation operationId is required' && missingIdentifiers.errors[1] === 'Relationship operation relationshipId is required'),
    assert('invalid relationship payload', invalidRelationship.status === 'invalid' && invalidRelationship.errors.includes('Link relationship payload: Relationship confidence must be between 0 and 1')),
    assert('invalid confidence adjustment', invalidAdjustment.status === 'invalid' && invalidAdjustment.error === 'strengthen relationship operation confidenceDelta must be greater than 0 and at most 1'),
    assert('malformed payload rejected', invalidPayloadShape.status === 'invalid' && invalidPayloadShape.error === 'Relationship operation payload must be an object'),
    assert('operationId preservation', identity.operationId === 'operation-preserved'),
    assert('idempotencyKey preservation', identity.idempotencyKey === 'idempotency-preserved'),
    assert('deterministic normalization', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('deterministic validation error ordering', JSON.stringify(deterministicErrorA.errors) === JSON.stringify(deterministicErrorB.errors) && deterministicErrorA.errors[0] === 'Relationship operation operationId is required'),
    assert('validated lifecycle events', eventResult.status === 'valid' && events.map((event) => event.phase).join(',') === [RELATIONSHIP_OPERATION_PHASES.proposed, RELATIONSHIP_OPERATION_PHASES.normalized, RELATIONSHIP_OPERATION_PHASES.validated].join(',')),
    assert('rejected lifecycle events', rejectedEvents.map((event) => event.phase).join(',') === [RELATIONSHIP_OPERATION_PHASES.proposed, RELATIONSHIP_OPERATION_PHASES.normalized, RELATIONSHIP_OPERATION_PHASES.rejected].join(',')),
    assert('normalized errors', unsupported.type === 'relationship_operation_result' && unsupported.status === 'invalid' && Array.isArray(unsupported.errors)),
    assert('operations are inert', JSON.stringify(relationshipInput) === relationshipBefore && JSON.stringify(memoryState) === memoryBefore)
  ];
}
