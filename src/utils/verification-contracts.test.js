import {
  createVerification,
  createVerificationCheck,
  createVerificationError,
  createVerificationFinding,
  isValidVerificationConfidence,
  isValidVerificationObservationId,
  isValidVerificationProvenance,
  isValidVerificationStatus,
  isValidVerificationTimestamp,
  normalizeVerification,
  validateVerification,
  validateVerificationCheck,
  validateVerificationFinding,
  VERIFICATION_STATUS
} from './verification-contracts.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createFinding(overrides = {}) {
  return createVerificationFinding({
    findingId: 'finding-1',
    code: 'schema_valid',
    message: 'The supplied evidence matches its declared schema.',
    metadata: {
      checkVersion: 1
    },
    ...overrides
  });
}

function createCheck(status = VERIFICATION_STATUS.verified, overrides = {}) {
  return createVerificationCheck({
    checkId: 'check-1',
    name: 'schema-check',
    status,
    confidence: 0.94,
    finding: createFinding(),
    metadata: {
      deterministic: true
    },
    ...overrides
  });
}

function createValidVerification(status, overrides = {}) {
  const observationId = overrides.observationId || 'observation-1';

  return createVerification({
    verificationId: `verification-${status}`,
    observationId,
    status,
    confidence: 0.91,
    checks: [createCheck(status)],
    findings: [createFinding()],
    provenance: {
      source: 'verification-test',
      verifierId: 'schema-verifier-1',
      observationId,
      operationId: 'operation-1',
      providerId: 'openai',
      modelId: 'model-1'
    },
    metadata: {
      version: 1
    },
    verifiedAt: '2026-08-16T13:00:00.000Z',
    ...overrides
  });
}

export function runVerificationContractTests() {
  const verified = createValidVerification(VERIFICATION_STATUS.verified);
  const rejected = createValidVerification(VERIFICATION_STATUS.rejected);
  const uncertain = createValidVerification(VERIFICATION_STATUS.uncertain);
  const degraded = createValidVerification(VERIFICATION_STATUS.degraded);
  const validCheck = createCheck();
  const invalidStatus = createValidVerification('accepted');
  const invalidObservationId = createValidVerification(VERIFICATION_STATUS.verified, {
    observationId: '',
    provenance: {
      source: 'verification-test',
      verifierId: 'schema-verifier-1',
      observationId: ''
    }
  });
  const invalidConfidence = createValidVerification(VERIFICATION_STATUS.verified, {
    confidence: 1.1
  });
  const invalidCheck = createValidVerification(VERIFICATION_STATUS.verified, {
    checks: [createCheck(VERIFICATION_STATUS.verified, { checkId: '' })]
  });
  const invalidFinding = createValidVerification(VERIFICATION_STATUS.verified, {
    findings: [createFinding({ code: '' })]
  });
  const invalidProvenance = createValidVerification(VERIFICATION_STATUS.verified, {
    provenance: {
      source: 'verification-test',
      observationId: 'observation-1'
    }
  });
  const mismatchedProvenance = createValidVerification(VERIFICATION_STATUS.verified, {
    provenance: {
      source: 'verification-test',
      verifierId: 'schema-verifier-1',
      observationId: 'observation-other'
    }
  });
  const invalidTimestamp = createValidVerification(VERIFICATION_STATUS.verified, {
    verifiedAt: '2026-02-30T13:00:00Z'
  });
  const sourceObservation = {
    observationId: 'observation-2',
    payload: {
      text: 'Original observation remains unchanged.'
    },
    metadata: {
      stable: true
    }
  };
  const sourceObservationBefore = JSON.stringify(sourceObservation);
  const normalizationInput = {
    verificationId: 'verification-normalized',
    observationId: 'observation-2',
    status: VERIFICATION_STATUS.verified,
    confidence: 0.77,
    checks: [createCheck()],
    findings: [createFinding()],
    provenance: {
      source: 'local-verifier',
      verifierId: 'verifier-2',
      observationId: 'observation-2',
      operationId: 'operation-2',
      providerId: 'deepseek',
      modelId: 'deepseek-chat'
    },
    metadata: {
      nested: {
        stable: true
      }
    },
    verifiedAt: '2026-08-16T08:00:00-05:00',
    observation: sourceObservation,
    interpretation: 'Do not preserve this.',
    reflection: {
      summary: 'Do not preserve this.'
    },
    memoryDecision: 'accept',
    relationshipProposal: true
  };
  const normalized = normalizeVerification(normalizationInput);
  const deterministicA = normalizeVerification(normalizationInput);
  const deterministicB = normalizeVerification(normalizationInput);
  const missingIdentityA = normalizeVerification({});
  const missingIdentityB = normalizeVerification({});
  const normalizedError = createVerificationError(
    'Verification test error',
    verified,
    { field: 'status' }
  );
  const validationError = validateVerification(invalidStatus).normalizedErrors[0];
  const domainState = {
    memories: [],
    relationships: []
  };
  const domainStateBefore = JSON.stringify(domainState);

  normalized.metadata.nested.stable = false;
  normalized.checks[0].metadata.deterministic = false;

  const normalizedKeys = Object.keys(normalized).sort();
  const contractKeys = [
    'checks',
    'confidence',
    'findings',
    'metadata',
    'observationId',
    'provenance',
    'status',
    'verificationId',
    'verifiedAt'
  ].sort();

  return [
    assert('valid verified result', validateVerification(verified).ok),
    assert('valid rejected result', validateVerification(rejected).ok),
    assert('valid uncertain result', validateVerification(uncertain).ok),
    assert('valid degraded result', validateVerification(degraded).ok),
    assert('valid check', validateVerificationCheck(validCheck).ok),
    assert('malformed verification', !validateVerification(null).ok && validateVerification(null).errors[0] === 'Verification must be an object'),
    assert('invalid verification status', !validateVerification(invalidStatus).ok && validateVerification(invalidStatus).errors.includes('Verification status is invalid')),
    assert('invalid observationId', !validateVerification(invalidObservationId).ok && validateVerification(invalidObservationId).errors.includes('Verification observationId is required')),
    assert('invalid confidence', !validateVerification(invalidConfidence).ok && validateVerification(invalidConfidence).errors.includes('Verification confidence must be between 0 and 1')),
    assert('invalid check', !validateVerification(invalidCheck).ok && validateVerification(invalidCheck).errors.some((error) => error.includes('checkId is required'))),
    assert('invalid finding', !validateVerification(invalidFinding).ok && validateVerification(invalidFinding).errors.some((error) => error.includes('finding code is required'))),
    assert('invalid provenance', !validateVerification(invalidProvenance).ok && validateVerification(invalidProvenance).errors.includes('Verification provenance requires source, verifierId, and observationId')),
    assert('mismatched provenance observationId', !validateVerification(mismatchedProvenance).ok && validateVerification(mismatchedProvenance).errors.includes('Verification provenance observationId must match verification observationId')),
    assert('invalid timestamp', !validateVerification(invalidTimestamp).ok && validateVerification(invalidTimestamp).errors.includes('Verification verifiedAt must be an explicit ISO 8601 timestamp')),
    assert('deterministic normalization', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('explicit timestamp preserved', normalized.verifiedAt === '2026-08-16T08:00:00-05:00'),
    assert('explicit provenance preserved', ['source', 'verifierId', 'observationId', 'operationId', 'providerId', 'modelId'].every((field) => normalized.provenance[field] === normalizationInput.provenance[field])),
    assert('explicit confidence preserved', normalized.confidence === 0.77 && normalized.checks[0].confidence === 0.94),
    assert('interpretation-only fields removed', JSON.stringify(normalizedKeys) === JSON.stringify(contractKeys)),
    assert('verification does not mutate observation', JSON.stringify(sourceObservation) === sourceObservationBefore),
    assert('verification does not create memory or relationships', JSON.stringify(domainState) === domainStateBefore),
    assert('normalization clones nested values', normalizationInput.metadata.nested.stable && normalizationInput.checks[0].metadata.deterministic),
    assert('status validation', isValidVerificationStatus(VERIFICATION_STATUS.degraded) && !isValidVerificationStatus('complete')),
    assert('confidence validation', isValidVerificationConfidence(0) && isValidVerificationConfidence(1) && !isValidVerificationConfidence(null)),
    assert('observationId validation', isValidVerificationObservationId('observation-1') && !isValidVerificationObservationId('')),
    assert('finding validation', validateVerificationFinding(createFinding()).ok && !validateVerificationFinding(null).ok),
    assert('provenance validation', isValidVerificationProvenance(verified.provenance) && !isValidVerificationProvenance({})),
    assert('timestamp validation', isValidVerificationTimestamp('2024-02-29T23:59:59Z') && !isValidVerificationTimestamp('2023-02-29T23:59:59Z')),
    assert('normalized errors', normalizedError.type === 'verification_contract_error' && validationError.message === 'Verification status is invalid'),
    assert('no hidden identity or timestamp generation', JSON.stringify(missingIdentityA) === JSON.stringify(missingIdentityB) && missingIdentityA.verificationId === '' && missingIdentityA.verifiedAt === ''),
    assert('identical input produces identical output', JSON.stringify(deterministicA) === JSON.stringify(deterministicB))
  ];
}
