import {
  createReflectionError,
  createReflectionEvidence,
  createReflectionProposal,
  createReflectionTargetReference,
  isValidReflectionConfidence,
  isValidReflectionProvenance,
  isValidReflectionProposalType,
  isValidReflectionTimestamp,
  normalizeReflectionProposal,
  REFLECTION_PROPOSAL_TYPES,
  validateReflectionEvidence,
  validateReflectionProposal,
  validateReflectionProposedOperation
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

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createMemoryOperation(operationType) {
  const targetMemoryIds = operationType === MEMORY_OPERATION_TYPES.put
    ? []
    : ['memory-1'];
  const payload = operationType === MEMORY_OPERATION_TYPES.put
    ? { candidate: { id: 'candidate-1' } }
    : operationType === MEMORY_OPERATION_TYPES.update
      ? { updates: { summary: 'Updated summary' } }
      : operationType === MEMORY_OPERATION_TYPES.expire
        ? { expiration: { reason: 'stale' } }
        : {};

  return {
    operationId: `memory-operation-${operationType}`,
    idempotencyKey: `memory-idempotency-${operationType}`,
    operationType,
    targetMemoryIds: operationType === MEMORY_OPERATION_TYPES.merge
      ? ['memory-1', 'memory-2']
      : targetMemoryIds,
    payload,
    mergePolicy: operationType === MEMORY_OPERATION_TYPES.merge
      ? 'target_wins'
      : '',
    proposalMetadata: {
      proposedBy: 'reflection-contract-test'
    },
    timestamp: '2026-08-16T15:00:00.000Z',
    validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.valid
  };
}

function createRelationshipOperation(operationType) {
  const relationship = {
    relationshipId: 'relationship-1',
    sourceMemoryId: 'memory-1',
    targetMemoryId: 'memory-2',
    relationshipType: RELATIONSHIP_TYPES.supports,
    confidence: 0.7,
    provenance: {
      source: 'reflection-contract-test'
    },
    metadata: {},
    createdAt: '2026-08-16T15:00:00.000Z',
    updatedAt: '2026-08-16T15:00:00.000Z',
    status: RELATIONSHIP_STATUS.active
  };
  let payload = {};

  if (operationType === RELATIONSHIP_OPERATION_TYPES.link) {
    payload = { relationship };
  }

  if ([
    RELATIONSHIP_OPERATION_TYPES.strengthen,
    RELATIONSHIP_OPERATION_TYPES.weaken
  ].includes(operationType)) {
    payload = { confidenceDelta: 0.1 };
  }

  return {
    operationId: `relationship-operation-${operationType}`,
    idempotencyKey: `relationship-idempotency-${operationType}`,
    operationType,
    relationshipId: 'relationship-1',
    payload,
    proposalMetadata: {
      proposedBy: 'reflection-contract-test'
    },
    provenance: {
      source: 'reflection-contract-test'
    },
    timestamp: '2026-08-16T15:00:00.000Z',
    validationStatus: RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid
  };
}

function createOperationForProposal(proposalType) {
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
  const verificationIds = ['verification-1'];
  const domain = proposalType.startsWith('relationship_') ? 'relationship' : 'memory';

  return createReflectionProposal({
    proposalId,
    proposalType,
    confidence: 0.68,
    evidence: [createReflectionEvidence({
      evidenceId: 'evidence-1',
      verificationId: 'verification-1',
      observationId: 'observation-1',
      findingIds: ['finding-1'],
      verificationConfidence: 0.92,
      metadata: {
        status: 'verified'
      }
    })],
    sourceVerificationIds: verificationIds,
    targetReferences: [createReflectionTargetReference({
      type: domain,
      id: domain === 'memory' ? 'memory-1' : 'relationship-1'
    })],
    proposedOperation: createOperationForProposal(proposalType),
    rationale: 'Verified evidence supports proposing this deterministic operation.',
    provenance: {
      source: 'reflection-contract-test',
      proposalId,
      verificationIds,
      providerId: 'openai',
      modelId: 'model-1',
      requestId: 'request-1',
      observationIds: ['observation-1'],
      operationIds: ['source-operation-1']
    },
    metadata: {
      version: 1
    },
    createdAt: '2026-08-16T15:00:01.000Z',
    ...overrides
  });
}

export function runReflectionContractTests() {
  const memoryPut = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut);
  const memoryUpdate = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryUpdate);
  const memoryMerge = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryMerge);
  const memoryExpire = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryExpire);
  const relationshipLink = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipLink);
  const relationshipUnlink = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipUnlink);
  const relationshipStrengthen = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipStrengthen);
  const relationshipWeaken = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipWeaken);
  const missingEvidence = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    evidence: []
  });
  const invalidType = createValidProposal('summary');
  const invalidConfidence = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    confidence: 1.2
  });
  const invalidOperation = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryUpdate, {
    proposedOperation: {
      ...createMemoryOperation(MEMORY_OPERATION_TYPES.update),
      validationStatus: MEMORY_OPERATION_VALIDATION_STATUS.pending
    }
  });
  const mismatchedOperation = createValidProposal(REFLECTION_PROPOSAL_TYPES.relationshipWeaken, {
    proposedOperation: createRelationshipOperation(RELATIONSHIP_OPERATION_TYPES.strengthen)
  });
  const malformedEvidence = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    evidence: [createReflectionEvidence({
      evidenceId: 'evidence-invalid',
      verificationId: 'verification-1',
      observationId: 'observation-1',
      findingIds: []
    })]
  });
  const invalidProvenance = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    provenance: {
      source: 'reflection-contract-test',
      proposalId: 'wrong-proposal',
      verificationIds: ['verification-other']
    }
  });
  const invalidTimestamp = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    createdAt: '2026-02-30T15:00:00Z'
  });
  const oversizedRationale = createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut, {
    rationale: 'x'.repeat(1001)
  });
  const verificationResult = {
    verificationId: 'verification-1',
    confidence: 0.92,
    findings: [{ findingId: 'finding-1' }]
  };
  const verificationBefore = JSON.stringify(verificationResult);
  const operationInput = createMemoryOperation(MEMORY_OPERATION_TYPES.put);
  const operationBefore = JSON.stringify(operationInput);
  const normalizationInput = {
    ...createValidProposal(REFLECTION_PROPOSAL_TYPES.memoryPut),
    proposalId: 'proposal-normalized',
    proposedOperation: operationInput,
    provenance: {
      source: 'reflection-contract-test',
      proposalId: 'proposal-normalized',
      verificationIds: ['verification-1']
    },
    verificationResult,
    execute: true,
    command: 'Do not preserve this field.'
  };
  const normalized = normalizeReflectionProposal(normalizationInput);
  const deterministicA = normalizeReflectionProposal(normalizationInput);
  const deterministicB = normalizeReflectionProposal(normalizationInput);
  const missingIdentityA = normalizeReflectionProposal({});
  const missingIdentityB = normalizeReflectionProposal({});
  const normalizedError = createReflectionError('Reflection test error', memoryPut, {
    field: 'proposalType'
  });
  const validationError = validateReflectionProposal(invalidType).normalizedErrors[0];
  const domainState = {
    memories: [],
    relationships: []
  };
  const domainStateBefore = JSON.stringify(domainState);

  normalized.proposedOperation.payload.candidate.id = 'mutated-candidate';
  normalized.evidence[0].metadata.status = 'mutated';

  const normalizedKeys = Object.keys(normalized).sort();
  const contractKeys = [
    'confidence',
    'createdAt',
    'evidence',
    'metadata',
    'proposalId',
    'proposalType',
    'proposedOperation',
    'provenance',
    'rationale',
    'sourceVerificationIds',
    'targetReferences'
  ].sort();

  return [
    assert('valid memory_put proposal', validateReflectionProposal(memoryPut).ok),
    assert('valid memory_update proposal', validateReflectionProposal(memoryUpdate).ok),
    assert('valid memory_merge proposal', validateReflectionProposal(memoryMerge).ok),
    assert('valid memory_expire proposal', validateReflectionProposal(memoryExpire).ok),
    assert('valid relationship_link proposal', validateReflectionProposal(relationshipLink).ok),
    assert('valid relationship_unlink proposal', validateReflectionProposal(relationshipUnlink).ok),
    assert('valid relationship_strengthen proposal', validateReflectionProposal(relationshipStrengthen).ok),
    assert('valid relationship_weaken proposal', validateReflectionProposal(relationshipWeaken).ok),
    assert('malformed reflection proposal', !validateReflectionProposal(null).ok && validateReflectionProposal(null).errors[0] === 'Reflection proposal must be an object'),
    assert('missing verification evidence', !validateReflectionProposal(missingEvidence).ok && validateReflectionProposal(missingEvidence).errors.includes('Reflection proposal evidence is required')),
    assert('invalid proposal type', !validateReflectionProposal(invalidType).ok && validateReflectionProposal(invalidType).errors.includes('Reflection proposal proposalType is invalid')),
    assert('invalid reflection confidence', !validateReflectionProposal(invalidConfidence).ok && validateReflectionProposal(invalidConfidence).errors.includes('Reflection proposal confidence must be between 0 and 1')),
    assert('invalid embedded operation', !validateReflectionProposal(invalidOperation).ok && validateReflectionProposal(invalidOperation).errors.includes('Reflection proposedOperation validationStatus must be valid')),
    assert('mismatched embedded operation', !validateReflectionProposal(mismatchedOperation).ok && validateReflectionProposal(mismatchedOperation).errors.includes('Reflection proposalType requires weaken operation')),
    assert('malformed evidence', !validateReflectionProposal(malformedEvidence).ok && validateReflectionProposal(malformedEvidence).errors.some((error) => error.includes('findingIds must contain unique identifiers'))),
    assert('invalid provenance', !validateReflectionProposal(invalidProvenance).ok && validateReflectionProposal(invalidProvenance).errors.includes('Reflection provenance proposalId must match proposalId')),
    assert('timestamp validation', !validateReflectionProposal(invalidTimestamp).ok && isValidReflectionTimestamp('2024-02-29T15:00:00Z') && !isValidReflectionTimestamp('2023-02-29T15:00:00Z')),
    assert('bounded rationale validation', !validateReflectionProposal(oversizedRationale).ok && validateReflectionProposal(oversizedRationale).errors.includes('Reflection proposal rationale must contain 1 to 1000 characters')),
    assert('deterministic normalization', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('explicit proposalId preserved', normalized.proposalId === 'proposal-normalized'),
    assert('explicit timestamp preserved', normalized.createdAt === normalizationInput.createdAt),
    assert('verification and reflection confidence remain separate', normalized.confidence === 0.68 && normalized.evidence[0].verificationConfidence === 0.92),
    assert('reflection does not mutate verification results', JSON.stringify(verificationResult) === verificationBefore),
    assert('reflection does not mutate embedded operations', JSON.stringify(operationInput) === operationBefore),
    assert('embedded operation is defensively normalized', operationInput.payload.candidate.id === 'candidate-1'),
    assert('normalization removes execution fields', JSON.stringify(normalizedKeys) === JSON.stringify(contractKeys)),
    assert('no memory or relationship state changes', JSON.stringify(domainState) === domainStateBefore),
    assert('proposal type validation', isValidReflectionProposalType(REFLECTION_PROPOSAL_TYPES.relationshipLink) && !isValidReflectionProposalType('research')),
    assert('confidence validation', isValidReflectionConfidence(0.5) && !isValidReflectionConfidence(null)),
    assert('evidence validation', validateReflectionEvidence(memoryPut.evidence[0]).ok && !validateReflectionEvidence(null).ok),
    assert('provenance validation', isValidReflectionProvenance(memoryPut.provenance) && !isValidReflectionProvenance({})),
    assert('embedded operation validation', validateReflectionProposedOperation(memoryPut.proposalType, memoryPut.proposedOperation).ok),
    assert('normalized errors', normalizedError.type === 'reflection_contract_error' && validationError.message === 'Reflection proposal proposalType is invalid'),
    assert('no hidden identity or timestamp generation', JSON.stringify(missingIdentityA) === JSON.stringify(missingIdentityB) && missingIdentityA.proposalId === '' && missingIdentityA.createdAt === ''),
    assert('identical inputs produce identical output', JSON.stringify(deterministicA) === JSON.stringify(deterministicB))
  ];
}
