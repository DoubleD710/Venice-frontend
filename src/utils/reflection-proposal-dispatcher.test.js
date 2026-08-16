import {
  createReflectionEvidence,
  createReflectionProposal,
  createReflectionTargetReference,
  REFLECTION_PROPOSAL_TYPES
} from './reflection-contracts.js';
import {
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS
} from './memory-operation-contracts.js';
import { createMemoryOperationExecutor } from './memory-operation-executor.js';
import {
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import { createRelationshipOperationExecutor } from './relationship-operation-executor.js';
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES
} from './relationship-types.js';
import { createReflectionProposalDispatcher } from './reflection-proposal-dispatcher.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createMemoryOperation(operationType) {
  let payload = {};

  if (operationType === MEMORY_OPERATION_TYPES.put) {
    payload = {
      candidate: {
        id: 'candidate-1'
      },
      card: {
        id: 'memory-1',
        summary: 'Proposed memory'
      }
    };
  }

  if (operationType === MEMORY_OPERATION_TYPES.update) {
    payload = {
      updates: {
        summary: 'Updated memory'
      }
    };
  }

  if (operationType === MEMORY_OPERATION_TYPES.expire) {
    payload = {
      expiration: {
        reason: 'stale'
      }
    };
  }

  return {
    operationId: `memory-operation-${operationType}`,
    idempotencyKey: `memory-idempotency-${operationType}`,
    operationType,
    targetMemoryIds: operationType === MEMORY_OPERATION_TYPES.put
      ? []
      : operationType === MEMORY_OPERATION_TYPES.merge
        ? ['memory-1', 'memory-2']
        : ['memory-1'],
    payload,
    mergePolicy: operationType === MEMORY_OPERATION_TYPES.merge ? 'target_wins' : '',
    proposalMetadata: {
      proposedBy: 'dispatcher-test'
    },
    timestamp: '2026-08-16T16:00:00.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  };
}

function createRelationshipOperation(operationType) {
  let payload = {};

  if (operationType === RELATIONSHIP_OPERATION_TYPES.link) {
    payload = {
      relationship: {
        relationshipId: 'relationship-1',
        sourceMemoryId: 'memory-1',
        targetMemoryId: 'memory-2',
        relationshipType: RELATIONSHIP_TYPES.supports,
        confidence: 0.7,
        provenance: {
          source: 'dispatcher-test'
        },
        metadata: {},
        createdAt: '2026-08-16T16:00:00.000Z',
        updatedAt: '2026-08-16T16:00:00.000Z',
        status: RELATIONSHIP_STATUS.active
      }
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
    operationId: `relationship-operation-${operationType}`,
    idempotencyKey: `relationship-idempotency-${operationType}`,
    operationType,
    relationshipId: 'relationship-1',
    payload,
    proposalMetadata: {
      proposedBy: 'dispatcher-test'
    },
    provenance: {
      source: 'dispatcher-test'
    },
    timestamp: '2026-08-16T16:00:00.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
  };
}

function operationForProposal(proposalType) {
  const operations = {
    [REFLECTION_PROPOSAL_TYPES.memoryPut]: createMemoryOperation(MEMORY_OPERATION_TYPES.put),
    [REFLECTION_PROPOSAL_TYPES.memoryUpdate]: createMemoryOperation(MEMORY_OPERATION_TYPES.update),
    [REFLECTION_PROPOSAL_TYPES.memoryMerge]: createMemoryOperation(MEMORY_OPERATION_TYPES.merge),
    [REFLECTION_PROPOSAL_TYPES.memoryExpire]: createMemoryOperation(MEMORY_OPERATION_TYPES.expire),
    [REFLECTION_PROPOSAL_TYPES.relationshipLink]: createRelationshipOperation(RELATIONSHIP_OPERATION_TYPES.link),
    [REFLECTION_PROPOSAL_TYPES.relationshipUnlink]: createRelationshipOperation(RELATIONSHIP_OPERATION_TYPES.unlink),
    [REFLECTION_PROPOSAL_TYPES.relationshipStrengthen]: createRelationshipOperation(RELATIONSHIP_OPERATION_TYPES.strengthen),
    [REFLECTION_PROPOSAL_TYPES.relationshipWeaken]: createRelationshipOperation(RELATIONSHIP_OPERATION_TYPES.weaken)
  };

  return operations[proposalType] || createMemoryOperation(MEMORY_OPERATION_TYPES.put);
}

function createValidProposal(proposalType, overrides = {}) {
  const proposalId = overrides.proposalId || `proposal-${proposalType}`;
  const domain = proposalType.startsWith('relationship_') ? 'relationship' : 'memory';

  return createReflectionProposal({
    proposalId,
    proposalType,
    confidence: 0.75,
    evidence: [createReflectionEvidence({
      evidenceId: 'evidence-1',
      verificationId: 'verification-1',
      observationId: 'observation-1',
      findingIds: ['finding-1'],
      verificationConfidence: 0.9
    })],
    sourceVerificationIds: ['verification-1'],
    targetReferences: [createReflectionTargetReference({
      type: domain,
      id: domain === 'memory' ? 'memory-1' : 'relationship-1'
    })],
    proposedOperation: operationForProposal(proposalType),
    rationale: 'Verified evidence supports this deterministic operation proposal.',
    provenance: {
      source: 'dispatcher-test',
      proposalId,
      verificationIds: ['verification-1'],
      providerId: 'openai',
      modelId: 'model-1',
      requestId: 'request-1'
    },
    metadata: {},
    createdAt: '2026-08-16T16:00:01.000Z',
    ...overrides
  });
}

function createMockExecutor(domain, { fail = false, throwError = false, mutateOperation = false } = {}) {
  const calls = [];

  return {
    calls,
    executor: {
      execute(operation) {
        calls.push(operation.operationId);

        if (mutateOperation) {
          operation.payload.dispatcherMutation = true;
        }

        if (throwError) {
          throw new Error(`Injected ${domain} executor failure`);
        }

        if (fail) {
          return {
            type: `${domain}_execution_result`,
            status: 'error',
            success: false,
            error: `Injected ${domain} executor rejection`
          };
        }

        return {
          type: `${domain}_execution_result`,
          status: 'complete',
          success: true,
          operationId: operation.operationId,
          idempotencyKey: operation.idempotencyKey || ''
        };
      }
    }
  };
}

function dispatchWithFreshMocks(proposal) {
  const memory = createMockExecutor('memory');
  const relationship = createMockExecutor('relationship');

  return createReflectionProposalDispatcher({
    memoryExecutor: memory.executor,
    relationshipExecutor: relationship.executor
  }).dispatch(proposal);
}

export function runReflectionProposalDispatcherTests() {
  const memory = createMockExecutor('memory');
  const relationship = createMockExecutor('relationship');
  const dispatcher = createReflectionProposalDispatcher({
    memoryExecutor: memory.executor,
    relationshipExecutor: relationship.executor
  });

  const memoryPut = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut));
  const memoryUpdate = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryUpdate));
  const memoryMerge = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryMerge));
  const memoryExpire = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryExpire));
  const relationshipLink = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipLink));
  const relationshipUnlink = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipUnlink));
  const relationshipStrengthen = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipStrengthen));
  const relationshipWeaken = dispatcher.dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipWeaken));
  const validMemoryCalls = [...memory.calls];
  const validRelationshipCalls = [...relationship.calls];

  const callsBeforeInvalid = memory.calls.length + relationship.calls.length;
  const invalidProposal = dispatcher.dispatch(createValidProposal(
    REFLECTION_PROPOSAL_TYPES.memoryPut,
    { confidence: 2 }
  ));
  const mismatchedProposal = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryUpdate);
  mismatchedProposal.proposedOperation.operationType = MEMORY_OPERATION_TYPES.expire;
  const mismatch = dispatcher.dispatch(mismatchedProposal);
  const unsupportedProposal = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut);
  unsupportedProposal.proposalType = 'research';
  const unsupported = dispatcher.dispatch(unsupportedProposal);
  const malformedOperation = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut);
  malformedOperation.proposedOperation = null;
  const malformed = dispatcher.dispatch(malformedOperation);
  const callsAfterInvalid = memory.calls.length + relationship.calls.length;

  const failedMemory = createMockExecutor('memory', { fail: true });
  const failedResult = createReflectionProposalDispatcher({
    memoryExecutor: failedMemory.executor,
    relationshipExecutor: relationship.executor
  }).dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut));
  const thrownRelationship = createMockExecutor('relationship', { throwError: true });
  const thrownResult = createReflectionProposalDispatcher({
    memoryExecutor: memory.executor,
    relationshipExecutor: thrownRelationship.executor
  }).dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipLink));
  const unavailableExecutor = createReflectionProposalDispatcher({
    relationshipExecutor: relationship.executor
  }).dispatch(createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut));

  const identityProposal = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    proposalId: 'proposal-preserved',
    proposedOperation: {
      ...createMemoryOperation(MEMORY_OPERATION_TYPES.put),
      operationId: 'operation-preserved',
      idempotencyKey: 'idempotency-preserved'
    }
  });
  const identity = dispatcher.dispatch(identityProposal);
  const deterministicProposal = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipWeaken, {
    proposalId: 'proposal-deterministic'
  });
  const deterministicA = dispatchWithFreshMocks(deterministicProposal);
  const deterministicB = dispatchWithFreshMocks(deterministicProposal);

  const immutableMock = createMockExecutor('memory', { mutateOperation: true });
  const immutableProposal = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut);
  const immutableBefore = JSON.stringify(immutableProposal);
  createReflectionProposalDispatcher({
    memoryExecutor: immutableMock.executor,
    relationshipExecutor: relationship.executor
  }).dispatch(immutableProposal);

  const memoryRuntimeAdapter = {
    intakeCandidate(candidate) {
      return {
        status: 'complete',
        candidate
      };
    },
    acceptCandidate(candidateId, card) {
      return {
        status: 'complete',
        card: {
          id: card.id || candidateId,
          summary: card.summary || ''
        }
      };
    }
  };
  const relationshipRuntimeAdapter = {
    linkRelationship(operation) {
      return {
        status: 'complete',
        relationshipId: operation.relationshipId
      };
    }
  };
  const integrationDispatcher = createReflectionProposalDispatcher({
    memoryExecutor: createMemoryOperationExecutor({ runtime: memoryRuntimeAdapter }),
    relationshipExecutor: createRelationshipOperationExecutor({
      runtime: relationshipRuntimeAdapter
    })
  });
  const memoryIntegration = integrationDispatcher.dispatch(
    createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut)
  );
  const relationshipIntegration = integrationDispatcher.dispatch(
    createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipLink)
  );

  const domainState = {
    memories: [],
    relationships: []
  };
  const domainStateBefore = JSON.stringify(domainState);
  const dispatcherSurface = Object.keys(createReflectionProposalDispatcher());

  return [
    assert('valid memory_put dispatch', memoryPut.status === 'complete' && memoryPut.domain === 'memory'),
    assert('valid memory_update dispatch', memoryUpdate.status === 'complete' && memoryUpdate.domain === 'memory'),
    assert('valid memory_merge dispatch', memoryMerge.status === 'complete' && memoryMerge.domain === 'memory'),
    assert('valid memory_expire dispatch', memoryExpire.status === 'complete' && memoryExpire.domain === 'memory'),
    assert('valid relationship_link dispatch', relationshipLink.status === 'complete' && relationshipLink.domain === 'relationship'),
    assert('valid relationship_unlink dispatch', relationshipUnlink.status === 'complete' && relationshipUnlink.domain === 'relationship'),
    assert('valid relationship_strengthen dispatch', relationshipStrengthen.status === 'complete' && relationshipStrengthen.domain === 'relationship'),
    assert('valid relationship_weaken dispatch', relationshipWeaken.status === 'complete' && relationshipWeaken.domain === 'relationship'),
    assert('memory proposals dispatch exactly once', JSON.stringify(validMemoryCalls) === JSON.stringify([
      'memory-operation-put',
      'memory-operation-update',
      'memory-operation-merge',
      'memory-operation-expire'
    ])),
    assert('relationship proposals dispatch exactly once', JSON.stringify(validRelationshipCalls) === JSON.stringify([
      'relationship-operation-link',
      'relationship-operation-unlink',
      'relationship-operation-strengthen',
      'relationship-operation-weaken'
    ])),
    assert('invalid proposal rejected', invalidProposal.status === 'error' && invalidProposal.normalizedError.category === 'contract'),
    assert('proposal operation mismatch rejected', mismatch.status === 'error' && mismatch.error === 'Reflection proposalType requires update operation'),
    assert('unsupported proposal rejected', unsupported.status === 'error' && unsupported.normalizedError.category === 'contract'),
    assert('malformed operation rejected', malformed.status === 'error' && malformed.error === 'Reflection proposedOperation must be an object'),
    assert('precondition failures do not dispatch', callsBeforeInvalid === callsAfterInvalid),
    assert('executor failure normalized', failedResult.status === 'error' && failedResult.error === 'Injected memory executor rejection' && failedMemory.calls.length === 1),
    assert('thrown executor failure normalized', thrownResult.status === 'error' && thrownResult.error === 'Injected relationship executor failure' && thrownRelationship.calls.length === 1),
    assert('missing executor rejected before dispatch', unavailableExecutor.status === 'error' && unavailableExecutor.normalizedError.category === 'precondition'),
    assert('proposalId preserved', identity.proposalId === 'proposal-preserved'),
    assert('operationId preserved', identity.operationId === 'operation-preserved'),
    assert('idempotencyKey preserved', identity.idempotencyKey === 'idempotency-preserved'),
    assert('provenance preserved', JSON.stringify(identity.provenance) === JSON.stringify(identityProposal.provenance)),
    assert('deterministic results', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('dispatcher isolates proposal from executor mutation', JSON.stringify(immutableProposal) === immutableBefore),
    assert('dispatcher owns no domain state', JSON.stringify(domainState) === domainStateBefore && dispatcherSurface.length === 1 && dispatcherSurface[0] === 'dispatch'),
    assert('Memory Operation Executor integration', memoryIntegration.status === 'complete' && memoryIntegration.executorResult.type === 'memory_operation_execution_result'),
    assert('Relationship Operation Executor integration', relationshipIntegration.status === 'complete' && relationshipIntegration.executorResult.type === 'relationship_operation_execution_result')
  ];
}
