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
import {
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES
} from './relationship-types.js';
import {
  createVerification,
  createVerificationCheck,
  createVerificationFinding,
  VERIFICATION_STATUS
} from './verification-contracts.js';
import { createReflectionRuntime } from './reflection-runtime.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidVerification(id = 'verification-1', observationId = 'observation-1') {
  const finding = createVerificationFinding({
    findingId: `finding-${id}`,
    code: 'evidence_verified',
    message: 'The evidence passed its deterministic checks.',
    metadata: {}
  });

  return createVerification({
    verificationId: id,
    observationId,
    status: VERIFICATION_STATUS.verified,
    confidence: 0.9,
    checks: [createVerificationCheck({
      checkId: `check-${id}`,
      name: 'evidence-check',
      status: VERIFICATION_STATUS.verified,
      confidence: 0.9,
      finding,
      metadata: {}
    })],
    findings: [finding],
    provenance: {
      source: 'reflection-runtime-test',
      verifierId: 'verifier-1',
      observationId
    },
    metadata: {},
    verifiedAt: '2026-08-16T17:00:00.000Z'
  });
}

function createMemoryOperation(operationType = MEMORY_OPERATION_TYPES.put) {
  let payload = {};

  if (operationType === MEMORY_OPERATION_TYPES.put) {
    payload = { candidate: { id: 'candidate-1' } };
  }

  if (operationType === MEMORY_OPERATION_TYPES.update) {
    payload = { updates: { summary: 'Updated memory' } };
  }

  return {
    operationId: `memory-operation-${operationType}`,
    idempotencyKey: `memory-idempotency-${operationType}`,
    operationType,
    targetMemoryIds: operationType === MEMORY_OPERATION_TYPES.put ? [] : ['memory-1'],
    payload,
    mergePolicy: '',
    proposalMetadata: { proposedBy: 'reflection-runtime-test' },
    timestamp: '2026-08-16T17:00:01.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  };
}

function createRelationshipOperation() {
  return {
    operationId: 'relationship-operation-link',
    idempotencyKey: 'relationship-idempotency-link',
    operationType: RELATIONSHIP_OPERATION_TYPES.link,
    relationshipId: 'relationship-1',
    payload: {
      relationship: {
        relationshipId: 'relationship-1',
        sourceMemoryId: 'memory-1',
        targetMemoryId: 'memory-2',
        relationshipType: RELATIONSHIP_TYPES.supports,
        confidence: 0.8,
        provenance: { source: 'reflection-runtime-test' },
        metadata: {},
        createdAt: '2026-08-16T17:00:01.000Z',
        updatedAt: '2026-08-16T17:00:01.000Z',
        status: RELATIONSHIP_STATUS.active
      }
    },
    proposalMetadata: { proposedBy: 'reflection-runtime-test' },
    provenance: { source: 'reflection-runtime-test' },
    timestamp: '2026-08-16T17:00:01.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
  };
}

function createValidProposal({
  proposalId = 'proposal-1',
  proposalType = REFLECTION_PROPOSAL_TYPES.memoryPut,
  verificationId = 'verification-1',
  observationId = 'observation-1',
  proposedOperation,
  createdAt = '2026-08-16T17:00:02.000Z'
} = {}) {
  const relationshipProposal = proposalType === REFLECTION_PROPOSAL_TYPES.relationshipLink;

  return createReflectionProposal({
    proposalId,
    proposalType,
    confidence: 0.75,
    evidence: [createReflectionEvidence({
      evidenceId: `evidence-${proposalId}`,
      verificationId,
      observationId,
      findingIds: [`finding-${verificationId}`],
      verificationConfidence: 0.9,
      metadata: {}
    })],
    sourceVerificationIds: [verificationId],
    targetReferences: [createReflectionTargetReference({
      type: relationshipProposal ? 'relationship' : 'memory',
      id: relationshipProposal ? 'relationship-1' : 'memory-1'
    })],
    proposedOperation: proposedOperation || (
      relationshipProposal ? createRelationshipOperation() : createMemoryOperation()
    ),
    rationale: 'Verified evidence supports this inert proposal.',
    provenance: {
      source: 'reflection-runtime-test',
      proposalId,
      verificationIds: [verificationId],
      observationIds: [observationId]
    },
    metadata: { strategy: 'injected-test-strategy' },
    createdAt
  });
}

function runWithCandidates(candidates, verifications = [createValidVerification()]) {
  return createReflectionRuntime({
    strategy: {
      reflect() {
        return candidates;
      }
    }
  }).reflect(verifications, { requestId: 'reflection-request-1' });
}

export function runReflectionRuntimeTests() {
  const memoryProposal = createValidProposal();
  const relationshipProposal = createValidProposal({
    proposalId: 'proposal-2',
    proposalType: REFLECTION_PROPOSAL_TYPES.relationshipLink,
    createdAt: '2026-08-16T17:00:03.000Z'
  });
  const single = runWithCandidates([memoryProposal]);
  const multiple = runWithCandidates([memoryProposal, relationshipProposal]);
  const empty = runWithCandidates([]);

  const malformed = runWithCandidates([null, memoryProposal]);
  const invalidOperationProposal = createValidProposal();
  invalidOperationProposal.proposedOperation.operationId = '';
  const invalidOperation = runWithCandidates([invalidOperationProposal]);
  const mismatchProposal = createValidProposal({
    proposedOperation: createMemoryOperation(MEMORY_OPERATION_TYPES.update)
  });
  const mismatch = runWithCandidates([mismatchProposal]);
  const missingReferenceProposal = createValidProposal({ verificationId: 'verification-missing' });
  const missingReference = runWithCandidates([missingReferenceProposal]);

  const strategyFailure = createReflectionRuntime({
    strategy: {
      reflect() {
        throw new Error('Injected reflection failure');
      }
    }
  }).reflect([createValidVerification()]);
  const malformedStrategyResult = createReflectionRuntime({
    strategy: { reflect: () => memoryProposal }
  }).reflect([createValidVerification()]);
  const asyncStrategy = createReflectionRuntime({
    strategy: { reflect: () => Promise.resolve([]) }
  }).reflect([createValidVerification()]);
  const missingStrategy = createReflectionRuntime().reflect([createValidVerification()]);
  const invalidVerification = runWithCandidates([memoryProposal], [{ verificationId: '' }]);

  const orderedProposalA = createValidProposal({ proposalId: 'proposal-a' });
  const orderedProposalB = createValidProposal({ proposalId: 'proposal-b' });
  const ordered = runWithCandidates([orderedProposalB, null, orderedProposalA]);

  const explicitProposal = createValidProposal({
    proposalId: 'proposal-explicit',
    createdAt: '2026-08-16T17:30:00.000Z'
  });
  const explicit = runWithCandidates([explicitProposal]);

  const verificationInput = [createValidVerification()];
  const contextInput = {
    nested: { stable: true }
  };
  const verificationBefore = JSON.stringify(verificationInput);
  const contextBefore = JSON.stringify(contextInput);
  const isolated = createReflectionRuntime({
    strategy: {
      reflect(verifications, context) {
        verifications[0].metadata.mutated = true;
        context.nested.stable = false;
        return [memoryProposal];
      }
    }
  }).reflect(verificationInput, contextInput);

  const deterministicA = runWithCandidates([memoryProposal, relationshipProposal]);
  const deterministicB = runWithCandidates([memoryProposal, relationshipProposal]);
  const domainState = {
    memories: [],
    relationships: []
  };
  const domainStateBefore = JSON.stringify(domainState);
  const runtimeSurface = Object.keys(createReflectionRuntime());

  return [
    assert('valid single proposal', single.status === 'complete' && single.proposals.length === 1 && single.rejections.length === 0),
    assert('multiple proposals', multiple.proposals.length === 2 && multiple.proposals[0].proposalId === 'proposal-1' && multiple.proposals[1].proposalId === 'proposal-2'),
    assert('zero proposals', empty.status === 'complete' && empty.proposals.length === 0 && empty.rejections.length === 0),
    assert('malformed proposal rejected individually', malformed.status === 'complete' && malformed.proposals.length === 1 && malformed.rejections.length === 1 && malformed.rejections[0].index === 0),
    assert('invalid embedded operation rejected', invalidOperation.proposals.length === 0 && invalidOperation.rejections[0].normalizedError.category === 'contract'),
    assert('proposal operation mismatch rejected', mismatch.proposals.length === 0 && mismatch.rejections[0].error === 'Reflection proposalType requires put operation'),
    assert('missing evidence reference rejected', missingReference.proposals.length === 0 && missingReference.rejections[0].normalizedError.code === 'reflection_runtime_unknown_verification_reference'),
    assert('strategy failure normalized', strategyFailure.status === 'error' && strategyFailure.error === 'Injected reflection failure' && strategyFailure.normalizedError.category === 'strategy'),
    assert('malformed strategy result normalized', malformedStrategyResult.status === 'error' && malformedStrategyResult.normalizedError.code === 'reflection_runtime_malformed_strategy_result'),
    assert('async strategy rejected', asyncStrategy.status === 'error' && asyncStrategy.normalizedError.code === 'reflection_runtime_async_strategy_unsupported'),
    assert('missing strategy rejected', missingStrategy.status === 'error' && missingStrategy.normalizedError.category === 'configuration'),
    assert('invalid verification rejected', invalidVerification.status === 'error' && invalidVerification.normalizedError.code === 'reflection_runtime_invalid_verification'),
    assert('proposal ordering preserved', ordered.proposals.map((proposal) => proposal.proposalId).join(',') === 'proposal-b,proposal-a'),
    assert('rejection ordering preserves candidate index', ordered.rejections.length === 1 && ordered.rejections[0].index === 1),
    assert('proposal identity preserved', explicit.proposals[0].proposalId === 'proposal-explicit'),
    assert('provenance preserved', JSON.stringify(explicit.proposals[0].provenance) === JSON.stringify(explicitProposal.provenance)),
    assert('explicit timestamp preserved', explicit.proposals[0].createdAt === '2026-08-16T17:30:00.000Z'),
    assert('verification input immutable', JSON.stringify(verificationInput) === verificationBefore),
    assert('context input immutable', JSON.stringify(contextInput) === contextBefore),
    assert('strategy receives isolated inputs', isolated.status === 'complete' && isolated.proposals.length === 1),
    assert('identical input and strategy are deterministic', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('no domain state mutation', JSON.stringify(domainState) === domainStateBefore),
    assert('runtime exposes reflection only', runtimeSurface.length === 1 && runtimeSurface[0] === 'reflect')
  ];
}
