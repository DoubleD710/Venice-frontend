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
import { createReasoningCore } from './reasoning-core.js';
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

function runMemoryPath() {
  const observation = createDeterministicObservation();
  const observationBefore = JSON.stringify(observation);
  const verificationContext = createVerificationContext();
  const memoryRuntime = createMemoryRuntime();
  const memoryExecutor = createMemoryOperationExecutor({ runtime: memoryRuntime });
  let verificationSeenByStrategy = '';
  const reflectionRuntime = createReflectionRuntime({
    strategy: {
      reflect(verifications) {
        const proposal = createProposal(verifications[0], 'memory');

        verificationSeenByStrategy = JSON.stringify(verifications[0]);
        verifications[0].metadata.strategyMutation = true;
        return [proposal];
      }
    }
  });
  const dispatcher = createReflectionProposalDispatcher({ memoryExecutor });
  const core = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime,
    dispatcher
  });
  const stateBeforeRun = memoryRuntime.listCards();
  const result = core.run({ observation, verificationContext });
  const finalState = memoryRuntime.listCards();

  return {
    observation,
    observationBefore,
    memoryRuntime,
    memoryExecutor,
    dispatcher,
    core,
    result,
    verificationSeenByStrategy,
    stateBeforeRun,
    finalState
  };
}

function runRelationshipPath() {
  const observation = createDeterministicObservation();
  const observationBefore = JSON.stringify(observation);
  const verificationContext = createVerificationContext();
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
  const dispatcher = createReflectionProposalDispatcher({ relationshipExecutor });
  const core = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime,
    dispatcher
  });
  const stateBeforeRun = relationshipRuntime.listRelationships();
  const result = core.run({ observation, verificationContext });
  const finalState = relationshipRuntime.listRelationships();

  return {
    observation,
    observationBefore,
    relationshipRuntime,
    relationshipExecutor,
    dispatcher,
    core,
    result,
    stateBeforeRun,
    finalState
  };
}

function deterministicSnapshot(path) {
  return {
    result: path.result,
    finalState: path.finalState
  };
}

function createTrackedCore({ observation, verification, reflection, dispatch }) {
  const calls = {
    observation: 0,
    verification: 0,
    reflection: 0,
    dispatch: 0
  };
  const core = createReasoningCore({
    observationRuntime: {
      record(input) {
        calls.observation += 1;
        return observation.record(input);
      }
    },
    verificationRuntime: {
      verify(input, context) {
        calls.verification += 1;
        return verification.verify(input, context);
      }
    },
    reflectionRuntime: {
      reflect(input, context) {
        calls.reflection += 1;
        return reflection.reflect(input, context);
      }
    },
    dispatcher: {
      dispatch(proposal) {
        calls.dispatch += 1;
        return dispatch.dispatch(proposal);
      }
    }
  });

  return { core, calls };
}

export function runReasoningCoreIntegrationTests() {
  const memoryA = runMemoryPath();
  const memoryB = runMemoryPath();
  const relationshipA = runRelationshipPath();
  const relationshipB = runRelationshipPath();

  const noProposalReflection = createReflectionRuntime({
    strategy: { reflect: () => [] }
  });
  const noDispatch = { dispatch: () => ({ status: 'complete', success: true }) };
  const observationFailureFixture = createTrackedCore({
    observation: createObservationRuntime(),
    verification: createDeterministicVerificationRuntime(),
    reflection: noProposalReflection,
    dispatch: noDispatch
  });
  const invalidObservation = createDeterministicObservation();
  invalidObservation.observationId = '';
  const observationFailure = observationFailureFixture.core.run({
    observation: invalidObservation,
    verificationContext: createVerificationContext()
  });

  const invalidVerificationRuntime = createVerificationRuntime({
    checks: [{
      id: 'invalid-check',
      name: 'invalid-check'
    }]
  });
  const verificationFailureFixture = createTrackedCore({
    observation: createObservationRuntime(),
    verification: invalidVerificationRuntime,
    reflection: noProposalReflection,
    dispatch: noDispatch
  });
  const verificationFailure = verificationFailureFixture.core.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  const malformedRuntime = createMemoryRuntime();
  const malformedReflectionRuntime = createReflectionRuntime({
    strategy: {
      reflect(verifications) {
        const malformedProposal = createProposal(verifications[0], 'memory');

        malformedProposal.proposalId = '';
        return [malformedProposal];
      }
    }
  });
  const malformedCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: malformedReflectionRuntime,
    dispatcher: createReflectionProposalDispatcher({
      memoryExecutor: createMemoryOperationExecutor({ runtime: malformedRuntime })
    })
  });
  const malformedReflection = malformedCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  const reflectionFailureRuntime = createMemoryRuntime();
  const reflectionFailureCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        reflect() {
          throw new Error('Injected reflection failure');
        }
      }
    }),
    dispatcher: createReflectionProposalDispatcher({
      memoryExecutor: createMemoryOperationExecutor({ runtime: reflectionFailureRuntime })
    })
  });
  const reflectionFailure = reflectionFailureCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  const dispatcherFailureRuntime = createMemoryRuntime();
  const dispatcherFailureCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        reflect(verifications) {
          return [
            createProposal(verifications[0], 'memory'),
            createProposal(verifications[0], 'memory', {
              proposalId: 'reasoning-memory-proposal-after-failure'
            })
          ];
        }
      }
    }),
    dispatcher: createReflectionProposalDispatcher()
  });
  const dispatcherFailure = dispatcherFailureCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  const failureRelationshipRuntime = createRelationshipRuntime();
  const failureRelationshipExecutor = createRelationshipOperationExecutor({
    runtime: failureRelationshipRuntime
  });
  failureRelationshipExecutor.execute(createRelationshipLinkOperation());
  const duplicateOperation = createRelationshipLinkOperation({
    operationId: 'reasoning-relationship-link-duplicate',
    relationshipId: 'reasoning-relationship-duplicate'
  });
  const executorFailureCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        reflect(verifications) {
          return [createProposal(verifications[0], 'relationship', {
            proposalId: 'reasoning-relationship-proposal-duplicate',
            proposedOperation: duplicateOperation,
            provenance: {
              source: 'reasoning-core-integration-test',
              proposalId: 'reasoning-relationship-proposal-duplicate',
              verificationIds: ['reasoning-verification-1'],
              observationIds: ['reasoning-observation-1'],
              operationIds: [duplicateOperation.operationId]
            }
          })];
        }
      }
    }),
    dispatcher: createReflectionProposalDispatcher({
      relationshipExecutor: failureRelationshipExecutor
    })
  });
  const relationshipBeforeFailure = failureRelationshipRuntime.listRelationships();
  const executorFailure = executorFailureCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });
  const relationshipAfterFailure = failureRelationshipRuntime.listRelationships();

  const memorySnapshot = memoryA.memoryRuntime.getCard('reasoning-memory-1');
  memorySnapshot.summary = 'External mutation must not enter runtime state.';
  const relationshipSnapshot = relationshipA.relationshipRuntime.getRelationship(
    'reasoning-relationship-1'
  );
  relationshipSnapshot.confidence = 0;

  return [
    assert('memory observation accepted', memoryA.result.observationResult.status === 'complete'),
    assert('memory verification succeeds', memoryA.result.verificationResult.status === 'complete' && memoryA.result.verificationResult.verification.status === VERIFICATION_STATUS.verified),
    assert('memory reflection generates valid proposal', memoryA.result.reflectionResult.status === 'complete' && memoryA.result.reflectionResult.proposals.length === 1 && memoryA.result.reflectionResult.rejections.length === 0),
    assert('memory proposal dispatch succeeds', memoryA.result.status === 'complete' && memoryA.result.dispatchResults[0].domain === 'memory'),
    assert('memory operation executes through executor', memoryA.result.dispatchResults[0].executorResult.success === true && memoryA.memoryExecutor.getDiagnostics().executionCount === 1),
    assert('memory state reflects expected result', memoryA.finalState.length === 1 && memoryA.finalState[0].id === 'reasoning-memory-1'),
    assert('relationship observation accepted', relationshipA.result.observationResult.status === 'complete'),
    assert('relationship verification succeeds', relationshipA.result.verificationResult.status === 'complete' && relationshipA.result.verificationResult.verification.status === VERIFICATION_STATUS.verified),
    assert('relationship reflection generates valid proposal', relationshipA.result.reflectionResult.status === 'complete' && relationshipA.result.reflectionResult.proposals.length === 1 && relationshipA.result.reflectionResult.rejections.length === 0),
    assert('relationship proposal dispatch succeeds', relationshipA.result.status === 'complete' && relationshipA.result.dispatchResults[0].domain === 'relationship'),
    assert('relationship operation executes through executor', relationshipA.result.dispatchResults[0].executorResult.success === true && relationshipA.result.dispatchResults[0].executorResult.metadata.adapterMethod === 'linkRelationship'),
    assert('relationship state reflects expected result', relationshipA.finalState.length === 1 && relationshipA.finalState[0].relationshipId === 'reasoning-relationship-1'),
    assert('Observation failure gates downstream stages', observationFailure.status === 'error' && observationFailure.stage === 'observation' && observationFailureFixture.calls.observation === 1 && observationFailureFixture.calls.verification === 0 && observationFailureFixture.calls.reflection === 0 && observationFailureFixture.calls.dispatch === 0),
    assert('Verification failure gates Reflection and dispatch', verificationFailure.status === 'error' && verificationFailure.stage === 'verification' && verificationFailureFixture.calls.verification === 1 && verificationFailureFixture.calls.reflection === 0 && verificationFailureFixture.calls.dispatch === 0),
    assert('malformed Reflection proposal is rejected without dispatch', malformedReflection.status === 'rejected' && malformedReflection.dispatchResults.length === 0 && malformedReflection.reflectionResult.rejections.length === 1 && malformedRuntime.listCards().length === 0),
    assert('Reflection failure gates dispatch', reflectionFailure.status === 'error' && reflectionFailure.stage === 'reflection' && reflectionFailureRuntime.listCards().length === 0),
    assert('Dispatcher rejection gates later proposals and leaves state unchanged', dispatcherFailure.status === 'error' && dispatcherFailure.stage === 'dispatch' && dispatcherFailure.dispatchResults.length === 1 && dispatcherFailureRuntime.listCards().length === 0),
    assert('executor failure produces no unexpected state mutation', executorFailure.status === 'error' && executorFailure.stage === 'dispatch' && JSON.stringify(relationshipAfterFailure) === JSON.stringify(relationshipBeforeFailure)),
    assert('memory repeated run has identical proposal', JSON.stringify(memoryA.result.reflectionResult.proposals) === JSON.stringify(memoryB.result.reflectionResult.proposals)),
    assert('relationship repeated run has identical proposal', JSON.stringify(relationshipA.result.reflectionResult.proposals) === JSON.stringify(relationshipB.result.reflectionResult.proposals)),
    assert('memory repeated run is deterministic', JSON.stringify(deterministicSnapshot(memoryA)) === JSON.stringify(deterministicSnapshot(memoryB))),
    assert('relationship repeated run is deterministic', JSON.stringify(deterministicSnapshot(relationshipA)) === JSON.stringify(deterministicSnapshot(relationshipB))),
    assert('operation ids are deterministic', memoryA.result.dispatchResults[0].operationId === memoryB.result.dispatchResults[0].operationId && relationshipA.result.dispatchResults[0].operationId === relationshipB.result.dispatchResults[0].operationId),
    assert('Observation remains unchanged', JSON.stringify(memoryA.observation) === memoryA.observationBefore && JSON.stringify(relationshipA.observation) === relationshipA.observationBefore),
    assert('Verification Result remains isolated from strategy mutation', JSON.stringify(memoryA.result.verificationResult.verification) === memoryA.verificationSeenByStrategy),
    assert('Reflection Runtime does not directly mutate memory state', malformedRuntime.listCards().length === 0 && reflectionFailureRuntime.listCards().length === 0),
    assert('Reflection Runtime does not directly mutate relationship state', relationshipA.stateBeforeRun.length === 0),
    assert('Dispatcher owns no domain state', Object.keys(memoryA.dispatcher).join(',') === 'dispatch' && Object.keys(relationshipA.dispatcher).join(',') === 'dispatch'),
    assert('Reasoning Core owns no domain state', Object.keys(memoryA.core).join(',') === 'run' && Object.keys(relationshipA.core).join(',') === 'run'),
    assert('executors are the mutation boundary', memoryA.stateBeforeRun.length === 0 && memoryA.finalState.length === 1 && relationshipA.stateBeforeRun.length === 0 && relationshipA.finalState.length === 1),
    assert('Memory Runtime remains sole memory state owner', memoryA.memoryRuntime.getCard('reasoning-memory-1').summary === 'The user prefers deterministic local-first systems.'),
    assert('Relationship Runtime remains sole relationship state owner', relationshipA.relationshipRuntime.getRelationship('reasoning-relationship-1').confidence === 0.8)
  ];
}
