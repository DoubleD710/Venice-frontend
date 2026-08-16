import {
  createObservation,
  OBSERVATION_TYPES
} from './observation-contracts.js';
import { createObservationRuntime } from './observation-runtime.js';
import {
  createVerificationFinding,
  VERIFICATION_STATUS
} from './verification-contracts.js';
import { createVerificationRuntime } from './verification-runtime.js';
import {
  createReflectionEvidence,
  createReflectionProposal,
  createReflectionTargetReference,
  REFLECTION_PROPOSAL_TYPES
} from './reflection-contracts.js';
import { createReflectionRuntime } from './reflection-runtime.js';
import { createReflectionProposalDispatcher } from './reflection-proposal-dispatcher.js';
import {
  createMemoryOperation,
  MEMORY_OPERATION_TYPES,
  MEMORY_OPERATION_VALIDATION_STATUS
} from './memory-operation-contracts.js';
import { createMemoryOperationExecutor } from './memory-operation-executor.js';
import { createMemoryRuntime } from './memory-runtime.js';
import { MEMORY_TYPES } from './memory-types.js';
import {
  createRelationshipOperation,
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import { createRelationshipOperationExecutor } from './relationship-operation-executor.js';
import { createRelationshipRuntime } from './relationship-runtime.js';
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

function createDeterministicObservation() {
  return createObservation({
    observationId: 'reasoning-observation-1',
    type: OBSERVATION_TYPES.userInput,
    source: 'reasoning-core-integration-test',
    subject: 'conversation-1',
    occurredAt: '2026-08-16T18:00:00.000Z',
    recordedAt: '2026-08-16T18:00:01.000Z',
    payload: {
      text: 'The user prefers deterministic local-first systems.'
    },
    provenance: {
      sourceType: 'request',
      sourceId: 'request-1',
      operationId: 'observation-operation-1',
      requestId: 'request-1'
    },
    confidence: null,
    metadata: {
      deterministic: true
    }
  });
}

function createDeterministicVerificationRuntime() {
  return createVerificationRuntime({
    checks: [{
      id: 'reasoning-check-1',
      name: 'deterministic-evidence-check',
      check() {
        return {
          status: VERIFICATION_STATUS.verified,
          confidence: 0.95,
          finding: createVerificationFinding({
            findingId: 'reasoning-finding-1',
            code: 'evidence_verified',
            message: 'The deterministic evidence is valid.',
            metadata: {}
          }),
          metadata: {
            deterministic: true
          }
        };
      }
    }]
  });
}

function createVerificationContext() {
  return {
    verificationId: 'reasoning-verification-1',
    verifiedAt: '2026-08-16T18:00:02.000Z',
    provenance: {
      source: 'reasoning-core-integration-test',
      verifierId: 'reasoning-verifier-1',
      observationId: 'reasoning-observation-1',
      operationId: 'verification-operation-1'
    },
    metadata: {
      deterministic: true
    }
  };
}

function createMemoryPutOperation() {
  return createMemoryOperation({
    operationId: 'reasoning-memory-put-1',
    idempotencyKey: 'reasoning-memory-put-effect-1',
    operationType: MEMORY_OPERATION_TYPES.put,
    targetMemoryIds: [],
    payload: {
      candidate: {
        id: 'reasoning-candidate-1',
        source: 'observation:reasoning-observation-1',
        category: MEMORY_TYPES.preference,
        confidence: 0.95,
        evidence: ['reasoning-finding-1'],
        metadata: {
          verificationId: 'reasoning-verification-1'
        }
      },
      card: {
        id: 'reasoning-memory-1',
        summary: 'The user prefers deterministic local-first systems.',
        tags: ['deterministic', 'local-first']
      }
    },
    proposalMetadata: {
      proposedBy: 'deterministic-reflection-strategy'
    },
    timestamp: '2026-08-16T18:00:03.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  });
}

function createMemoryUpdateOperation() {
  return createMemoryOperation({
    operationId: 'reasoning-memory-update-1',
    idempotencyKey: 'reasoning-memory-update-effect-1',
    operationType: MEMORY_OPERATION_TYPES.update,
    targetMemoryIds: ['reasoning-memory-1'],
    payload: {
      updates: {
        summary: 'This mismatched operation must not execute.'
      }
    },
    proposalMetadata: {
      proposedBy: 'deterministic-reflection-strategy'
    },
    timestamp: '2026-08-16T18:00:03.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  });
}

function createRelationshipLinkOperation({
  operationId = 'reasoning-relationship-link-1',
  relationshipId = 'reasoning-relationship-1'
} = {}) {
  return createRelationshipOperation({
    operationId,
    idempotencyKey: `${operationId}-effect`,
    operationType: RELATIONSHIP_OPERATION_TYPES.link,
    relationshipId,
    payload: {
      relationship: {
        relationshipId,
        sourceMemoryId: 'reasoning-memory-source-1',
        targetMemoryId: 'reasoning-memory-target-1',
        relationshipType: RELATIONSHIP_TYPES.supports,
        confidence: 0.8,
        provenance: {
          source: 'reasoning-core-integration-test'
        },
        metadata: {
          verificationId: 'reasoning-verification-1'
        },
        createdAt: '2026-08-16T18:00:03.000Z',
        updatedAt: '2026-08-16T18:00:03.000Z',
        status: RELATIONSHIP_STATUS.active
      }
    },
    proposalMetadata: {
      proposedBy: 'deterministic-reflection-strategy'
    },
    provenance: {
      source: 'reasoning-core-integration-test'
    },
    timestamp: '2026-08-16T18:00:03.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
  });
}

function createProposal(verification, domain, overrides = {}) {
  const relationshipDomain = domain === 'relationship';
  const proposalId = overrides.proposalId || `reasoning-${domain}-proposal-1`;
  const proposalType = relationshipDomain
    ? REFLECTION_PROPOSAL_TYPES.relationshipLink
    : REFLECTION_PROPOSAL_TYPES.memoryPut;
  const proposedOperation = relationshipDomain
    ? createRelationshipLinkOperation()
    : createMemoryPutOperation();

  return createReflectionProposal({
    proposalId,
    proposalType,
    confidence: 0.9,
    evidence: [createReflectionEvidence({
      evidenceId: `reasoning-${domain}-evidence-1`,
      verificationId: verification.verificationId,
      observationId: verification.observationId,
      findingIds: verification.findings.map((finding) => finding.findingId),
      verificationConfidence: verification.confidence,
      metadata: {}
    })],
    sourceVerificationIds: [verification.verificationId],
    targetReferences: [createReflectionTargetReference({
      type: domain,
      id: relationshipDomain ? 'reasoning-relationship-1' : 'reasoning-memory-1'
    })],
    proposedOperation,
    rationale: 'Verified evidence supports this deterministic domain proposal.',
    provenance: {
      source: 'reasoning-core-integration-test',
      proposalId,
      verificationIds: [verification.verificationId],
      observationIds: [verification.observationId],
      operationIds: [proposedOperation.operationId]
    },
    metadata: {
      deterministic: true
    },
    createdAt: '2026-08-16T18:00:04.000Z',
    ...overrides
  });
}

function runVerifiedObservation() {
  const observationInput = createDeterministicObservation();
  const observationBefore = JSON.stringify(observationInput);
  const observationRuntime = createObservationRuntime();
  const observationResult = observationRuntime.record(observationInput);
  const verificationResult = createDeterministicVerificationRuntime().verify(
    observationResult.observation,
    createVerificationContext()
  );

  return {
    observationInput,
    observationBefore,
    observationRuntime,
    observationResult,
    verificationResult
  };
}

function runMemoryPath() {
  const verified = runVerifiedObservation();
  const verificationBefore = JSON.stringify(verified.verificationResult);
  const memoryRuntime = createMemoryRuntime();
  const memoryExecutor = createMemoryOperationExecutor({ runtime: memoryRuntime });
  const reflectionRuntime = createReflectionRuntime({
    strategy: {
      reflect(verifications) {
        return [createProposal(verifications[0], 'memory')];
      }
    }
  });
  const stateBeforeReflection = memoryRuntime.listCards();
  const reflectionResult = reflectionRuntime.reflect([
    verified.verificationResult.verification
  ]);
  const stateAfterReflection = memoryRuntime.listCards();
  const dispatcher = createReflectionProposalDispatcher({ memoryExecutor });
  const dispatchResult = dispatcher.dispatch(reflectionResult.proposals[0]);
  const finalState = memoryRuntime.listCards();

  return {
    ...verified,
    verificationBefore,
    memoryRuntime,
    memoryExecutor,
    reflectionRuntime,
    dispatcher,
    reflectionResult,
    dispatchResult,
    stateBeforeReflection,
    stateAfterReflection,
    finalState
  };
}

function runRelationshipPath() {
  const verified = runVerifiedObservation();
  const verificationBefore = JSON.stringify(verified.verificationResult);
  const relationshipRuntime = createRelationshipRuntime();
  const relationshipExecutor = createRelationshipOperationExecutor({
    runtime: relationshipRuntime
  });
  const reflectionRuntime = createReflectionRuntime({
    strategy: {
      reflect(verifications) {
        return [createProposal(verifications[0], 'relationship')];
      }
    }
  });
  const stateBeforeReflection = relationshipRuntime.listRelationships();
  const reflectionResult = reflectionRuntime.reflect([
    verified.verificationResult.verification
  ]);
  const stateAfterReflection = relationshipRuntime.listRelationships();
  const dispatcher = createReflectionProposalDispatcher({ relationshipExecutor });
  const dispatchResult = dispatcher.dispatch(reflectionResult.proposals[0]);
  const finalState = relationshipRuntime.listRelationships();

  return {
    ...verified,
    verificationBefore,
    relationshipRuntime,
    relationshipExecutor,
    reflectionRuntime,
    dispatcher,
    reflectionResult,
    dispatchResult,
    stateBeforeReflection,
    stateAfterReflection,
    finalState
  };
}

function deterministicSnapshot(path) {
  return {
    observationResult: path.observationResult,
    verificationResult: path.verificationResult,
    reflectionResult: path.reflectionResult,
    dispatchResult: path.dispatchResult,
    finalState: path.finalState
  };
}

export function runReasoningCoreIntegrationTests() {
  const memoryA = runMemoryPath();
  const memoryB = runMemoryPath();
  const relationshipA = runRelationshipPath();
  const relationshipB = runRelationshipPath();

  let failedReflectionCalls = 0;
  const failedVerification = createVerificationRuntime({
    checks: [{
      id: 'invalid-check',
      name: 'invalid-check'
    }]
  }).verify(createDeterministicObservation(), createVerificationContext());
  const guardedReflectionRuntime = createReflectionRuntime({
    strategy: {
      reflect() {
        failedReflectionCalls += 1;
        return [];
      }
    }
  });

  if (failedVerification.status === 'complete') {
    guardedReflectionRuntime.reflect([failedVerification.verification]);
  }

  const malformedRuntime = createMemoryRuntime();
  const malformedReflection = createReflectionRuntime({
    strategy: {
      reflect(verifications) {
        const malformedProposal = createProposal(verifications[0], 'memory');

        malformedProposal.proposalId = '';
        return [malformedProposal];
      }
    }
  }).reflect([memoryA.verificationResult.verification]);

  const mismatchRuntime = createMemoryRuntime();
  const mismatchExecutor = createMemoryOperationExecutor({ runtime: mismatchRuntime });
  const mismatchDispatcher = createReflectionProposalDispatcher({
    memoryExecutor: mismatchExecutor
  });
  const mismatchedProposal = createProposal(
    memoryA.verificationResult.verification,
    'memory',
    { proposedOperation: createMemoryUpdateOperation() }
  );
  const mismatchResult = mismatchDispatcher.dispatch(mismatchedProposal);

  const duplicateOperation = createRelationshipLinkOperation({
    operationId: 'reasoning-relationship-link-duplicate',
    relationshipId: 'reasoning-relationship-duplicate'
  });
  const duplicateProposal = createProposal(
    relationshipA.verificationResult.verification,
    'relationship',
    {
      proposalId: 'reasoning-relationship-proposal-duplicate',
      proposedOperation: duplicateOperation,
      provenance: {
        source: 'reasoning-core-integration-test',
        proposalId: 'reasoning-relationship-proposal-duplicate',
        verificationIds: ['reasoning-verification-1'],
        observationIds: ['reasoning-observation-1'],
        operationIds: [duplicateOperation.operationId]
      }
    }
  );
  const relationshipBeforeFailure = relationshipA.relationshipRuntime.listRelationships();
  const executorFailure = relationshipA.dispatcher.dispatch(duplicateProposal);
  const relationshipAfterFailure = relationshipA.relationshipRuntime.listRelationships();

  const memorySnapshot = memoryA.memoryRuntime.getCard('reasoning-memory-1');
  memorySnapshot.summary = 'External mutation must not enter runtime state.';
  const relationshipSnapshot = relationshipA.relationshipRuntime.getRelationship(
    'reasoning-relationship-1'
  );
  relationshipSnapshot.confidence = 0;

  return [
    assert('memory observation accepted', memoryA.observationResult.status === 'complete'),
    assert('memory verification succeeds', memoryA.verificationResult.status === 'complete' && memoryA.verificationResult.verification.status === VERIFICATION_STATUS.verified),
    assert('memory reflection generates valid proposal', memoryA.reflectionResult.status === 'complete' && memoryA.reflectionResult.proposals.length === 1 && memoryA.reflectionResult.rejections.length === 0),
    assert('memory proposal dispatch succeeds', memoryA.dispatchResult.status === 'complete' && memoryA.dispatchResult.domain === 'memory'),
    assert('memory operation executes through executor', memoryA.dispatchResult.executorResult.success === true && memoryA.memoryExecutor.getDiagnostics().executionCount === 1),
    assert('memory state reflects expected result', memoryA.finalState.length === 1 && memoryA.finalState[0].id === 'reasoning-memory-1'),
    assert('relationship observation accepted', relationshipA.observationResult.status === 'complete'),
    assert('relationship verification succeeds', relationshipA.verificationResult.status === 'complete' && relationshipA.verificationResult.verification.status === VERIFICATION_STATUS.verified),
    assert('relationship reflection generates valid proposal', relationshipA.reflectionResult.status === 'complete' && relationshipA.reflectionResult.proposals.length === 1 && relationshipA.reflectionResult.rejections.length === 0),
    assert('relationship proposal dispatch succeeds', relationshipA.dispatchResult.status === 'complete' && relationshipA.dispatchResult.domain === 'relationship'),
    assert('relationship operation executes through executor', relationshipA.dispatchResult.executorResult.success === true && relationshipA.dispatchResult.executorResult.metadata.adapterMethod === 'linkRelationship'),
    assert('relationship state reflects expected result', relationshipA.finalState.length === 1 && relationshipA.finalState[0].relationshipId === 'reasoning-relationship-1'),
    assert('verification failure prevents reflection', failedVerification.status === 'error' && failedReflectionCalls === 0),
    assert('malformed proposal produces no state mutation', malformedReflection.proposals.length === 0 && malformedReflection.rejections.length === 1 && malformedRuntime.listCards().length === 0),
    assert('dispatcher rejects proposal operation mismatch', mismatchResult.status === 'error' && mismatchResult.error === 'Reflection proposalType requires put operation' && mismatchRuntime.listCards().length === 0),
    assert('executor failure produces no unexpected state mutation', executorFailure.status === 'error' && JSON.stringify(relationshipAfterFailure) === JSON.stringify(relationshipBeforeFailure)),
    assert('memory repeated run has identical proposal', JSON.stringify(memoryA.reflectionResult.proposals) === JSON.stringify(memoryB.reflectionResult.proposals)),
    assert('relationship repeated run has identical proposal', JSON.stringify(relationshipA.reflectionResult.proposals) === JSON.stringify(relationshipB.reflectionResult.proposals)),
    assert('memory repeated run is deterministic', JSON.stringify(deterministicSnapshot(memoryA)) === JSON.stringify(deterministicSnapshot(memoryB))),
    assert('relationship repeated run is deterministic', JSON.stringify(deterministicSnapshot(relationshipA)) === JSON.stringify(deterministicSnapshot(relationshipB))),
    assert('operation ids are deterministic', memoryA.dispatchResult.operationId === memoryB.dispatchResult.operationId && relationshipA.dispatchResult.operationId === relationshipB.dispatchResult.operationId),
    assert('Observation remains unchanged', JSON.stringify(memoryA.observationInput) === memoryA.observationBefore && JSON.stringify(relationshipA.observationInput) === relationshipA.observationBefore),
    assert('Verification Result remains unchanged', JSON.stringify(memoryA.verificationResult) === memoryA.verificationBefore && JSON.stringify(relationshipA.verificationResult) === relationshipA.verificationBefore),
    assert('Reflection Runtime does not mutate memory state', memoryA.stateBeforeReflection.length === 0 && memoryA.stateAfterReflection.length === 0),
    assert('Reflection Runtime does not mutate relationship state', relationshipA.stateBeforeReflection.length === 0 && relationshipA.stateAfterReflection.length === 0),
    assert('Dispatcher owns no domain state', Object.keys(memoryA.dispatcher).join(',') === 'dispatch' && Object.keys(relationshipA.dispatcher).join(',') === 'dispatch'),
    assert('executors are the mutation boundary', memoryA.stateAfterReflection.length === 0 && memoryA.finalState.length === 1 && relationshipA.stateAfterReflection.length === 0 && relationshipA.finalState.length === 1),
    assert('Memory Runtime remains sole memory state owner', memoryA.memoryRuntime.getCard('reasoning-memory-1').summary === 'The user prefers deterministic local-first systems.'),
    assert('Relationship Runtime remains sole relationship state owner', relationshipA.relationshipRuntime.getRelationship('reasoning-relationship-1').confidence === 0.8)
  ];
}
