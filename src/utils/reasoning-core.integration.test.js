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

function createAbortError() {
  const error = new Error('Injected reasoning abort');

  error.name = 'AbortError';
  return error;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
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
  relationshipId = 'reasoning-relationship-1',
  sourceMemoryId = 'reasoning-memory-source-1',
  targetMemoryId = 'reasoning-memory-target-1'
} = {}) {
  return createRelationshipOperation({
    operationId,
    idempotencyKey: `${operationId}-effect`,
    operationType: RELATIONSHIP_OPERATION_TYPES.link,
    relationshipId,
    payload: {
      relationship: {
        relationshipId,
        sourceMemoryId,
        targetMemoryId,
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
  const proposedOperation = overrides.proposedOperation || (
    relationshipDomain ? createRelationshipLinkOperation() : createMemoryPutOperation()
  );

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
      id: relationshipDomain ? proposedOperation.relationshipId : 'reasoning-memory-1'
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

async function runMemoryPath() {
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
  const result = await core.run({ observation, verificationContext });
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

async function runRelationshipPath() {
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
  const result = await core.run({ observation, verificationContext });
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

function createSequencedRelationshipOperation(index, {
  sourceMemoryId = `reasoning-sequence-source-${index}`,
  targetMemoryId = `reasoning-sequence-target-${index}`
} = {}) {
  return createRelationshipLinkOperation({
    operationId: `reasoning-sequence-operation-${index}`,
    relationshipId: `reasoning-sequence-relationship-${index}`,
    sourceMemoryId,
    targetMemoryId
  });
}

function createSequencedRelationshipProposal(verification, operation, index) {
  const proposalId = `reasoning-sequence-proposal-${index}`;

  return createProposal(verification, 'relationship', {
    proposalId,
    proposedOperation: operation,
    provenance: {
      source: 'reasoning-core-integration-test',
      proposalId,
      verificationIds: [verification.verificationId],
      observationIds: [verification.observationId],
      operationIds: [operation.operationId]
    }
  });
}

async function runRelationshipSequence(operations, seedOperations = []) {
  const relationshipRuntime = createRelationshipRuntime();
  const relationshipExecutor = createRelationshipOperationExecutor({
    runtime: relationshipRuntime
  });

  seedOperations.forEach((operation) => {
    relationshipExecutor.execute(operation);
  });

  const initialState = relationshipRuntime.listRelationships();
  const core = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        async reflect(verifications) {
          return operations.map((operation, index) => (
            createSequencedRelationshipProposal(verifications[0], operation, index)
          ));
        }
      }
    }),
    dispatcher: createReflectionProposalDispatcher({ relationshipExecutor })
  });
  const result = await core.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  return {
    result,
    initialState,
    finalState: relationshipRuntime.listRelationships()
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

export async function runReasoningCoreIntegrationTests() {
  const memoryA = await runMemoryPath();
  const memoryB = await runMemoryPath();
  const relationshipA = await runRelationshipPath();
  const relationshipB = await runRelationshipPath();
  const allSuccessful = await runRelationshipSequence([
    createSequencedRelationshipOperation(10),
    createSequencedRelationshipOperation(11),
    createSequencedRelationshipOperation(12)
  ]);
  const firstFailureSeed = createSequencedRelationshipOperation(90, {
    sourceMemoryId: 'reasoning-first-failure-source',
    targetMemoryId: 'reasoning-first-failure-target'
  });
  const firstFailure = await runRelationshipSequence([
    createSequencedRelationshipOperation(20, {
      sourceMemoryId: 'reasoning-first-failure-source',
      targetMemoryId: 'reasoning-first-failure-target'
    }),
    createSequencedRelationshipOperation(21)
  ], [firstFailureSeed]);
  const middleOperations = [
    createSequencedRelationshipOperation(30, {
      sourceMemoryId: 'reasoning-middle-shared-source',
      targetMemoryId: 'reasoning-middle-shared-target'
    }),
    createSequencedRelationshipOperation(31, {
      sourceMemoryId: 'reasoning-middle-shared-source',
      targetMemoryId: 'reasoning-middle-shared-target'
    }),
    createSequencedRelationshipOperation(32)
  ];
  const middleFailure = await runRelationshipSequence(middleOperations);
  const middleFailureRepeat = await runRelationshipSequence(middleOperations);
  const finalFailure = await runRelationshipSequence([
    createSequencedRelationshipOperation(40, {
      sourceMemoryId: 'reasoning-final-shared-source',
      targetMemoryId: 'reasoning-final-shared-target'
    }),
    createSequencedRelationshipOperation(41),
    createSequencedRelationshipOperation(42, {
      sourceMemoryId: 'reasoning-final-shared-source',
      targetMemoryId: 'reasoning-final-shared-target'
    })
  ]);
  const deferredReflection = createDeferred();
  const asyncRelationshipRuntime = createRelationshipRuntime();
  const asyncRelationshipExecutor = createRelationshipOperationExecutor({
    runtime: asyncRelationshipRuntime
  });
  const asyncDispatcher = createReflectionProposalDispatcher({
    relationshipExecutor: asyncRelationshipExecutor
  });
  const asyncDispatchOrder = [];
  const asyncController = new AbortController();
  let reasoningSignal = null;
  const asyncCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        async reflect(verifications, context, { signal }) {
          reasoningSignal = signal;
          const proposals = await deferredReflection.promise;

          return proposals.map((operation, index) => (
            createSequencedRelationshipProposal(verifications[0], operation, index)
          ));
        }
      }
    }),
    dispatcher: {
      dispatch(proposal) {
        asyncDispatchOrder.push(proposal.proposalId);
        return asyncDispatcher.dispatch(proposal);
      }
    }
  });
  const pendingAsyncRun = asyncCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  }, { signal: asyncController.signal });
  const dispatchCountBeforeReflection = asyncDispatchOrder.length;

  deferredReflection.resolve([
    createSequencedRelationshipOperation(70),
    createSequencedRelationshipOperation(71)
  ]);
  const asyncSuccess = await pendingAsyncRun;

  let asyncFailureDispatchCalls = 0;
  const asyncFailureCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        async reflect() {
          throw new Error('Injected async reflection failure');
        }
      }
    }),
    dispatcher: {
      dispatch() {
        asyncFailureDispatchCalls += 1;
      }
    }
  });
  const asyncReflectionFailure = await asyncFailureCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  });

  const abortController = new AbortController();
  let abortDispatchCalls = 0;
  let abortSignalSeen = null;
  const abortCore = createReasoningCore({
    observationRuntime: createObservationRuntime(),
    verificationRuntime: createDeterministicVerificationRuntime(),
    reflectionRuntime: createReflectionRuntime({
      strategy: {
        async reflect(verifications, context, { signal }) {
          abortSignalSeen = signal;

          return new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(createAbortError());
              return;
            }

            signal.addEventListener('abort', () => {
              reject(createAbortError());
            }, { once: true });
          });
        }
      }
    }),
    dispatcher: {
      dispatch() {
        abortDispatchCalls += 1;
      }
    }
  });
  const pendingAbortRun = abortCore.run({
    observation: createDeterministicObservation(),
    verificationContext: createVerificationContext()
  }, { signal: abortController.signal });

  abortController.abort();
  const asyncReflectionAbort = await pendingAbortRun;

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
  const observationFailure = await observationFailureFixture.core.run({
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
  const verificationFailure = await verificationFailureFixture.core.run({
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
  const malformedReflection = await malformedCore.run({
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
  const reflectionFailure = await reflectionFailureCore.run({
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
  const dispatcherFailure = await dispatcherFailureCore.run({
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
  const executorFailure = await executorFailureCore.run({
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
    assert('all proposals succeed in order', allSuccessful.result.status === 'complete' && allSuccessful.result.completedProposalCount === 3 && allSuccessful.result.dispatchResults.length === 3 && allSuccessful.result.unexecutedProposals.length === 0),
    assert('first proposal failure occurs before mutation', firstFailure.result.status === 'error' && firstFailure.result.completedProposalCount === 0 && firstFailure.result.failedProposalIndex === 0 && firstFailure.result.failedProposalId === 'reasoning-sequence-proposal-0' && JSON.stringify(firstFailure.finalState) === JSON.stringify(firstFailure.initialState)),
    assert('middle proposal failure reports partial completion', middleFailure.result.status === 'partial' && middleFailure.result.completedProposalCount === 1 && middleFailure.result.failedProposalIndex === 1 && middleFailure.result.failedProposalId === 'reasoning-sequence-proposal-1'),
    assert('final proposal failure reports earlier commits', finalFailure.result.status === 'partial' && finalFailure.result.completedProposalCount === 2 && finalFailure.result.failedProposalIndex === 2 && finalFailure.result.failedProposalId === 'reasoning-sequence-proposal-2'),
    assert('later proposals remain unexecuted after failure', middleFailure.result.dispatchResults.length === 2 && middleFailure.result.unexecutedProposals.length === 1 && middleFailure.result.unexecutedProposals[0].index === 2 && middleFailure.result.unexecutedProposals[0].proposalId === 'reasoning-sequence-proposal-2'),
    assert('committed state survives partial failure', middleFailure.finalState.length === 1 && middleFailure.finalState[0].relationshipId === 'reasoning-sequence-relationship-30' && finalFailure.finalState.length === 2),
    assert('committed result ordering is deterministic', finalFailure.result.dispatchResults.slice(0, finalFailure.result.completedProposalCount).map((result) => result.proposalId).join(',') === 'reasoning-sequence-proposal-0,reasoning-sequence-proposal-1'),
    assert('failure metadata is deterministic', JSON.stringify({ index: middleFailure.result.failedProposalIndex, id: middleFailure.result.failedProposalId, error: middleFailure.result.normalizedError }) === JSON.stringify({ index: middleFailureRepeat.result.failedProposalIndex, id: middleFailureRepeat.result.failedProposalId, error: middleFailureRepeat.result.normalizedError })),
    assert('identical multi-proposal runs are deterministic', JSON.stringify(middleFailure) === JSON.stringify(middleFailureRepeat)),
    assert('async Reflection succeeds before ordered dispatch', asyncSuccess.status === 'complete' && asyncSuccess.completedProposalCount === 2),
    assert('no dispatch occurs before async Reflection completes', dispatchCountBeforeReflection === 0),
    assert('async proposal dispatch order is deterministic', asyncDispatchOrder.join(',') === 'reasoning-sequence-proposal-0,reasoning-sequence-proposal-1' && asyncRelationshipRuntime.listRelationships().length === 2),
    assert('Reasoning Core propagates active signal', reasoningSignal === asyncController.signal),
    assert('async Reflection failure gates dispatch', asyncReflectionFailure.status === 'error' && asyncReflectionFailure.stage === 'reflection' && asyncFailureDispatchCalls === 0),
    assert('async Reflection abort stops before dispatch', asyncReflectionAbort.status === 'stopped' && asyncReflectionAbort.normalizedError.code === 'reflection_runtime_aborted' && abortSignalSeen === abortController.signal && abortDispatchCalls === 0),
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
