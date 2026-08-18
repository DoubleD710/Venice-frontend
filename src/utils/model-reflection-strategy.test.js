import {
  createModelReflectionRequest,
  createModelReflectionStrategy,
  parseModelReflectionResponse
} from './model-reflection-strategy.js';
import {
  createReflectionEvidence,
  createReflectionProposal,
  createReflectionTargetReference,
  REFLECTION_PROPOSAL_TYPES
} from './reflection-contracts.js';
import { createReflectionRuntime } from './reflection-runtime.js';
import { createReflectionProposalDispatcher } from './reflection-proposal-dispatcher.js';
import {
  createVerification,
  createVerificationCheck,
  createVerificationFinding,
  VERIFICATION_STATUS
} from './verification-contracts.js';
import {
  createMemoryOperation as createMemoryOperationContract,
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

function createVerifiedEvidence() {
  const finding = createVerificationFinding({
    findingId: 'model-finding-1',
    code: 'evidence_verified',
    message: 'The supplied evidence is verified.',
    metadata: {}
  });

  return createVerification({
    verificationId: 'model-verification-1',
    observationId: 'model-observation-1',
    status: VERIFICATION_STATUS.verified,
    confidence: 0.94,
    checks: [createVerificationCheck({
      checkId: 'model-check-1',
      name: 'model-evidence-check',
      status: VERIFICATION_STATUS.verified,
      confidence: 0.94,
      finding,
      metadata: {}
    })],
    findings: [finding],
    provenance: {
      source: 'model-reflection-strategy-test',
      verifierId: 'model-verifier-1',
      observationId: 'model-observation-1'
    },
    metadata: {},
    verifiedAt: '2026-08-16T19:00:00.000Z'
  });
}

function createMemoryOperation(operationType = MEMORY_OPERATION_TYPES.put) {
  return createMemoryOperationContract({
    operationId: `model-memory-operation-${operationType}`,
    idempotencyKey: `model-memory-effect-${operationType}`,
    operationType,
    targetMemoryIds: operationType === MEMORY_OPERATION_TYPES.put
      ? []
      : ['model-memory-1'],
    payload: operationType === MEMORY_OPERATION_TYPES.put
      ? {
          candidate: {
            id: 'model-candidate-1',
            source: 'verification:model-verification-1',
            category: MEMORY_TYPES.knowledge,
            confidence: 0.9,
            evidence: ['model-finding-1'],
            metadata: {}
          },
          card: {
            id: 'model-memory-1',
            summary: 'Verified model-proposed memory.',
            tags: ['model-proposal']
          }
        }
      : {
          updates: {
            summary: 'Mismatched update'
          }
        },
    proposalMetadata: {
      proposedBy: 'model-reflection-strategy'
    },
    timestamp: '2026-08-16T19:00:01.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  });
}

function createRelationshipLinkOperation() {
  return createRelationshipOperation({
    operationId: 'model-relationship-operation-link',
    idempotencyKey: 'model-relationship-effect-link',
    operationType: RELATIONSHIP_OPERATION_TYPES.link,
    relationshipId: 'model-relationship-1',
    payload: {
      relationship: {
        relationshipId: 'model-relationship-1',
        sourceMemoryId: 'model-memory-source-1',
        targetMemoryId: 'model-memory-target-1',
        relationshipType: RELATIONSHIP_TYPES.supports,
        confidence: 0.82,
        provenance: {
          source: 'model-reflection-strategy-test'
        },
        metadata: {},
        createdAt: '2026-08-16T19:00:01.000Z',
        updatedAt: '2026-08-16T19:00:01.000Z',
        status: RELATIONSHIP_STATUS.active
      }
    },
    proposalMetadata: {
      proposedBy: 'model-reflection-strategy'
    },
    provenance: {
      source: 'model-reflection-strategy-test'
    },
    timestamp: '2026-08-16T19:00:01.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
  });
}

function createProposal({
  proposalId = 'model-memory-proposal-1',
  proposalType = REFLECTION_PROPOSAL_TYPES.memoryPut,
  verificationId = 'model-verification-1',
  proposedOperation,
  targetType,
  targetId
} = {}) {
  const relationshipProposal = proposalType === REFLECTION_PROPOSAL_TYPES.relationshipLink;
  const operation = proposedOperation || (
    relationshipProposal ? createRelationshipLinkOperation() : createMemoryOperation()
  );

  return createReflectionProposal({
    proposalId,
    proposalType,
    confidence: 0.88,
    evidence: [createReflectionEvidence({
      evidenceId: `evidence-${proposalId}`,
      verificationId,
      observationId: 'model-observation-1',
      findingIds: ['model-finding-1'],
      verificationConfidence: 0.94,
      metadata: {}
    })],
    sourceVerificationIds: [verificationId],
    targetReferences: [createReflectionTargetReference({
      type: targetType || (relationshipProposal ? 'relationship' : 'memory'),
      id: targetId || (relationshipProposal ? 'model-relationship-1' : 'model-memory-1')
    })],
    proposedOperation: operation,
    rationale: 'The verified evidence supports this structured proposal.',
    provenance: {
      source: 'model-reflection-strategy-test',
      proposalId,
      verificationIds: [verificationId],
      observationIds: ['model-observation-1'],
      operationIds: [operation.operationId]
    },
    metadata: {},
    createdAt: '2026-08-16T19:00:02.000Z'
  });
}

function createResponse(proposals, metadata = {}) {
  return {
    structuredOutput: {
      proposals
    },
    metadata
  };
}

function runStrategy(response, options = {}) {
  const modelClient = options.modelClient || {
    generate() {
      return response;
    }
  };
  const strategy = createModelReflectionStrategy({
    modelClient,
    providerId: 'local-model-provider',
    modelId: 'local-model-1'
  });

  return createReflectionRuntime({ strategy }).reflect(
    [createVerifiedEvidence()],
    { requestId: 'model-request-1' },
    { signal: options.signal }
  );
}

function createAbortError() {
  const error = new Error('Injected model abort');

  error.name = 'AbortError';
  return error;
}

export async function runModelReflectionStrategyTests() {
  const validProposal = createProposal();
  const valid = await runStrategy(createResponse([validProposal], {
    requestId: 'transport-request-1'
  }));
  const multiple = await runStrategy(createResponse([
    validProposal,
    createProposal({
      proposalId: 'model-relationship-proposal-1',
      proposalType: REFLECTION_PROPOSAL_TYPES.relationshipLink
    })
  ]));
  const malformedResponse = await runStrategy(null);
  const missingVerification = await runStrategy(createResponse([
    createProposal({ verificationId: 'missing-verification' })
  ]));
  const invalidOperationProposal = createProposal();
  invalidOperationProposal.proposedOperation.operationId = '';
  const invalidOperation = await runStrategy(createResponse([invalidOperationProposal]));
  const mismatch = await runStrategy(createResponse([createProposal({
    proposedOperation: createMemoryOperation(MEMORY_OPERATION_TYPES.update)
  })]));
  const malformedOutput = await runStrategy({ structuredOutput: '{not-json' });
  const clientFailure = await runStrategy(null, {
    modelClient: {
      generate() {
        throw new Error('Injected model client failure');
      }
    }
  });
  const emptyResponse = await runStrategy({ structuredOutput: '' });
  const asyncClient = await runStrategy(null, {
    modelClient: {
      async generate() {
        return createResponse([validProposal], {
          providerId: 'async-provider',
          modelId: 'async-model',
          requestId: 'async-request'
        });
      }
    }
  });
  const malformedAsyncResponse = await runStrategy(null, {
    modelClient: {
      async generate() {
        return { structuredOutput: '{invalid-json' };
      }
    }
  });
  const asyncClientFailure = await runStrategy(null, {
    modelClient: {
      async generate() {
        throw new Error('Injected async model failure');
      }
    }
  });
  const abortController = new AbortController();
  let modelSignal = null;
  const abortedModel = await runStrategy(null, {
    signal: abortController.signal,
    modelClient: {
      async generate(request, { signal }) {
        modelSignal = signal;
        abortController.abort();
        throw createAbortError();
      }
    }
  });
  const deterministicResponse = createResponse([validProposal], {
    providerId: 'explicit-provider',
    modelId: 'explicit-model',
    requestId: 'explicit-request'
  });
  const deterministicA = parseModelReflectionResponse(deterministicResponse);
  const deterministicB = parseModelReflectionResponse(deterministicResponse);

  const capturedRequests = [];
  let dispatcherCalls = 0;
  let executorCalls = 0;
  const requestStrategy = createModelReflectionStrategy({
    modelClient: {
      generate(request) {
        capturedRequests.push(request);
        return createResponse([]);
      }
    }
  });
  await requestStrategy.reflect([createVerifiedEvidence()], {
    requestId: 'captured-request',
    dispatcher: {
      dispatch() {
        dispatcherCalls += 1;
      }
    },
    executor: {
      execute() {
        executorCalls += 1;
      }
    }
  });
  const directRequest = createModelReflectionRequest(
    [createVerifiedEvidence()],
    { requestId: 'direct-request' }
  );

  const memoryRuntime = createMemoryRuntime();
  const memoryReflection = await runStrategy(createResponse([validProposal]));
  const memoryDispatch = createReflectionProposalDispatcher({
    memoryExecutor: createMemoryOperationExecutor({ runtime: memoryRuntime })
  }).dispatch(memoryReflection.proposals[0]);

  const relationshipRuntime = createRelationshipRuntime();
  const relationshipReflection = await runStrategy(createResponse([createProposal({
    proposalId: 'model-relationship-proposal-1',
    proposalType: REFLECTION_PROPOSAL_TYPES.relationshipLink
  })]));
  const relationshipDispatch = createReflectionProposalDispatcher({
    relationshipExecutor: createRelationshipOperationExecutor({
      runtime: relationshipRuntime
    })
  }).dispatch(relationshipReflection.proposals[0]);

  const untouchedState = {
    memories: [],
    relationships: []
  };
  const untouchedBefore = JSON.stringify(untouchedState);
  const isolatedMemoryRuntime = createMemoryRuntime();
  const isolatedRelationshipRuntime = createRelationshipRuntime();

  await runStrategy(createResponse([validProposal]));

  return [
    assert('valid model response becomes valid proposal', valid.status === 'complete' && valid.proposals.length === 1 && valid.rejections.length === 0),
    assert('multiple valid proposals preserve order', multiple.proposals.length === 2 && multiple.proposals[0].proposalId === 'model-memory-proposal-1' && multiple.proposals[1].proposalId === 'model-relationship-proposal-1'),
    assert('malformed model response is normalized failure', malformedResponse.status === 'error' && malformedResponse.normalizedError.category === 'strategy'),
    assert('missing verification reference is rejected', missingVerification.proposals.length === 0 && missingVerification.rejections[0].normalizedError.code === 'reflection_runtime_unknown_verification_reference'),
    assert('invalid embedded operation is rejected', invalidOperation.proposals.length === 0 && invalidOperation.rejections[0].normalizedError.category === 'contract'),
    assert('proposal operation mismatch is rejected', mismatch.proposals.length === 0 && mismatch.rejections[0].error === 'Reflection proposalType requires put operation'),
    assert('malformed structured output is normalized failure', malformedOutput.status === 'error' && malformedOutput.error === 'Model reflection structured output is not valid JSON'),
    assert('model client failure is normalized', clientFailure.status === 'error' && clientFailure.error === 'Injected model client failure'),
    assert('empty model response is normalized failure', emptyResponse.status === 'error' && emptyResponse.error === 'Model reflection response was empty'),
    assert('async model client is supported', asyncClient.status === 'complete' && asyncClient.proposals.length === 1),
    assert('async model metadata is preserved', asyncClient.proposals[0].provenance.providerId === 'async-provider' && asyncClient.proposals[0].provenance.modelId === 'async-model' && asyncClient.proposals[0].provenance.requestId === 'async-request'),
    assert('malformed async response is normalized', malformedAsyncResponse.status === 'error' && malformedAsyncResponse.error === 'Model reflection structured output is not valid JSON'),
    assert('async model client failure is normalized', asyncClientFailure.status === 'error' && asyncClientFailure.error === 'Injected async model failure'),
    assert('abort signal propagates to model client', abortedModel.status === 'stopped' && modelSignal === abortController.signal && abortedModel.errorCode === 'reflection_runtime_aborted'),
    assert('identical model output parses deterministically', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('explicit model provenance is preserved', valid.proposals[0].provenance.providerId === 'local-model-provider' && valid.proposals[0].provenance.modelId === 'local-model-1' && valid.proposals[0].provenance.requestId === 'transport-request-1'),
    assert('request contains verified evidence only', capturedRequests.length === 1 && capturedRequests[0].verifiedEvidence[0].verificationId === 'model-verification-1' && !Object.prototype.hasOwnProperty.call(capturedRequests[0], 'observation')),
    assert('strategy receives no dispatcher or executor access', dispatcherCalls === 0 && executorCalls === 0 && !Object.prototype.hasOwnProperty.call(capturedRequests[0].context, 'dispatcher') && !Object.prototype.hasOwnProperty.call(capturedRequests[0].context, 'executor')),
    assert('request declares constrained structured output', directRequest.responseFormat.rootField === 'proposals' && directRequest.responseFormat.type === 'json'),
    assert('strategy does not mutate domain state', JSON.stringify(untouchedState) === untouchedBefore && isolatedMemoryRuntime.listCards().length === 0 && isolatedRelationshipRuntime.listRelationships().length === 0),
    assert('Memory integration changes state through dispatcher and executor', memoryDispatch.status === 'complete' && memoryRuntime.getCard('model-memory-1')?.summary === 'Verified model-proposed memory.'),
    assert('Relationship integration changes state through dispatcher and executor', relationshipDispatch.status === 'complete' && relationshipRuntime.getRelationship('model-relationship-1')?.relationshipType === RELATIONSHIP_TYPES.supports)
  ];
}
