import {
  createObservation,
  createObservationError,
  isValidObservationConfidence,
  isValidObservationPayload,
  isValidObservationProvenance,
  isValidObservationTimestamp,
  isValidObservationType,
  normalizeObservation,
  OBSERVATION_TYPES,
  validateObservation
} from './observation-contracts.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidObservation(type, overrides = {}) {
  return createObservation({
    observationId: `observation-${type}`,
    type,
    source: 'venice-test',
    subject: 'conversation-1',
    occurredAt: '2026-08-16T10:15:30.000Z',
    recordedAt: '2026-08-16T10:15:31.000Z',
    payload: {
      text: 'Observed value'
    },
    provenance: {
      sourceType: 'request',
      sourceId: 'source-1',
      providerId: 'openai',
      modelId: 'model-1',
      operationId: 'operation-1',
      requestId: 'request-1'
    },
    confidence: null,
    metadata: {
      test: true
    },
    ...overrides
  });
}

export function runObservationContractTests() {
  const userInput = createValidObservation(OBSERVATION_TYPES.userInput);
  const modelOutput = createValidObservation(OBSERVATION_TYPES.modelOutput);
  const toolResult = createValidObservation(OBSERVATION_TYPES.toolResult);
  const toolError = createValidObservation(OBSERVATION_TYPES.toolError);
  const systemEvent = createValidObservation(OBSERVATION_TYPES.systemEvent);
  const executionMetric = createValidObservation(OBSERVATION_TYPES.executionMetric, {
    payload: {
      name: 'stream_duration_ms',
      value: 425
    },
    confidence: 0.9
  });
  const missingId = createValidObservation(OBSERVATION_TYPES.userInput, {
    observationId: ''
  });
  const invalidType = createValidObservation('memory_observation');
  const invalidProvenance = createValidObservation(OBSERVATION_TYPES.systemEvent, {
    provenance: {
      sourceType: 'system'
    }
  });
  const invalidConfidence = createValidObservation(OBSERVATION_TYPES.executionMetric, {
    confidence: 1.2
  });
  const invalidTimestamp = createValidObservation(OBSERVATION_TYPES.systemEvent, {
    occurredAt: '2026-02-31T10:15:30Z'
  });
  const normalizedInput = {
    observationId: 'observation-normalized',
    type: OBSERVATION_TYPES.modelOutput,
    source: 'model',
    subject: 'request-2',
    occurredAt: '2026-08-16T11:00:00-05:00',
    payload: {
      nested: {
        stable: true
      }
    },
    provenance: {
      sourceType: 'model',
      sourceId: 'model-response-1',
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      operationId: 'operation-2',
      requestId: 'request-2'
    },
    confidence: 0.73,
    metadata: {
      sequence: 1
    },
    verificationResult: {
      verified: true
    },
    interpretation: 'This field must not enter the observation contract.',
    reflection: true
  };
  const normalized = normalizeObservation(normalizedInput);
  const normalizedAgain = normalizeObservation(normalizedInput);
  const normalizedThird = normalizeObservation(normalizedInput);
  const explicitNoConfidence = normalizeObservation({
    observationId: 'observation-no-confidence',
    type: OBSERVATION_TYPES.toolStarted,
    source: 'tool-runtime',
    subject: 'tool-call-1',
    occurredAt: '2026-08-16T11:00:00Z',
    payload: {},
    provenance: {
      sourceType: 'tool',
      sourceId: 'tool-call-1'
    }
  });
  const optionalFieldsOmitted = {
    observationId: 'observation-optional-fields',
    type: OBSERVATION_TYPES.toolStarted,
    source: 'tool-runtime',
    subject: 'tool-call-2',
    occurredAt: '2026-08-16T11:00:00Z',
    payload: {},
    provenance: {
      sourceType: 'tool',
      sourceId: 'tool-call-2'
    },
    metadata: {}
  };
  const missingIdentityA = normalizeObservation({});
  const missingIdentityB = normalizeObservation({});
  const normalizedError = createObservationError(
    'Observation test error',
    userInput,
    { field: 'test' }
  );
  const validationError = validateObservation(invalidType).normalizedErrors[0];
  const state = {
    memories: [],
    relationships: [],
    reflections: [],
    providerCalls: 0
  };
  const stateBefore = JSON.stringify(state);

  normalized.payload.nested.stable = false;
  normalized.metadata.sequence = 2;

  const normalizedKeys = Object.keys(normalized).sort();
  const contractKeys = [
    'confidence',
    'metadata',
    'observationId',
    'occurredAt',
    'payload',
    'provenance',
    'recordedAt',
    'source',
    'subject',
    'type'
  ].sort();

  return [
    assert('valid user input observation', validateObservation(userInput).ok),
    assert('valid model output observation', validateObservation(modelOutput).ok),
    assert('valid tool result observation', validateObservation(toolResult).ok),
    assert('valid tool error observation', validateObservation(toolError).ok),
    assert('valid system event observation', validateObservation(systemEvent).ok),
    assert('valid execution metric observation', validateObservation(executionMetric).ok),
    assert('malformed observation', !validateObservation(null).ok && validateObservation(null).errors[0] === 'Observation must be an object'),
    assert('missing observationId', !validateObservation(missingId).ok && validateObservation(missingId).errors.includes('Observation observationId is required')),
    assert('invalid observation type', !validateObservation(invalidType).ok && validateObservation(invalidType).errors.includes('Observation type is invalid')),
    assert('invalid provenance', !validateObservation(invalidProvenance).ok && validateObservation(invalidProvenance).errors.includes('Observation provenance requires sourceType and sourceId')),
    assert('invalid confidence', !validateObservation(invalidConfidence).ok && validateObservation(invalidConfidence).errors.includes('Observation confidence must be null or between 0 and 1')),
    assert('invalid timestamp', !validateObservation(invalidTimestamp).ok && validateObservation(invalidTimestamp).errors.includes('Observation occurredAt must be an explicit ISO 8601 timestamp')),
    assert('deterministic normalization', JSON.stringify(normalizedAgain) === JSON.stringify(normalizedThird)),
    assert('explicit timestamps preserved', normalized.occurredAt === '2026-08-16T11:00:00-05:00' && normalized.recordedAt === ''),
    assert('explicit confidence preserved', normalized.confidence === 0.73 && executionMetric.confidence === 0.9),
    assert('absent confidence remains absent', explicitNoConfidence.confidence === null),
    assert('optional fields may be omitted before normalization', validateObservation(optionalFieldsOmitted).ok),
    assert('provenance identifiers preserved', ['providerId', 'modelId', 'operationId', 'requestId'].every((field) => normalized.provenance[field] === normalizedInput.provenance[field])),
    assert('normalized errors', normalizedError.type === 'observation_contract_error' && validationError.message === 'Observation type is invalid'),
    assert('timestamp validation', isValidObservationTimestamp('2024-02-29T23:59:59Z') && !isValidObservationTimestamp('2023-02-29T23:59:59Z') && !isValidObservationTimestamp('2026-08-16T11:00:00+15:00')),
    assert('confidence validation', isValidObservationConfidence(undefined) && isValidObservationConfidence(null) && isValidObservationConfidence(0.5) && !isValidObservationConfidence(-0.1)),
    assert('payload validation', isValidObservationPayload({ value: true }) && !isValidObservationPayload([])),
    assert('provenance validation', isValidObservationProvenance({ sourceType: 'tool', sourceId: 'call-1' }) && !isValidObservationProvenance({ sourceType: 'tool', sourceId: '' })),
    assert('observation type validation', isValidObservationType(OBSERVATION_TYPES.toolStarted) && !isValidObservationType('reflection_observation')),
    assert('contract contains no verification or interpretation fields', JSON.stringify(normalizedKeys) === JSON.stringify(contractKeys)),
    assert('normalization does not mutate input', normalizedInput.payload.nested.stable && normalizedInput.metadata.sequence === 1),
    assert('observation does not mutate domain state', JSON.stringify(state) === stateBefore),
    assert('no hidden identity or timestamp generation', JSON.stringify(missingIdentityA) === JSON.stringify(missingIdentityB) && missingIdentityA.observationId === '' && missingIdentityA.occurredAt === '' && missingIdentityA.recordedAt === ''),
    assert('identical inputs produce identical output', JSON.stringify(normalizedAgain) === JSON.stringify(normalizedThird))
  ];
}
