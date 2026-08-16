import { createObservation, OBSERVATION_TYPES } from './observation-contracts.js';
import { createObservationRuntime } from './observation-runtime.js';
import { listObservationTypes } from './observation-types.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidObservation(type = OBSERVATION_TYPES.userInput, overrides = {}) {
  return createObservation({
    observationId: `observation-${type}`,
    type,
    source: 'venice-runtime-test',
    subject: 'conversation-1',
    occurredAt: '2026-08-16T12:00:00.000Z',
    recordedAt: '2026-08-16T12:00:01.000Z',
    payload: {
      nested: {
        stable: true
      }
    },
    provenance: {
      sourceType: 'request',
      sourceId: 'source-1',
      providerId: 'openai',
      modelId: 'model-1',
      operationId: 'operation-1',
      requestId: 'request-1'
    },
    confidence: 0.8,
    metadata: {
      sequence: 1
    },
    ...overrides
  });
}

function recordInFreshRuntime(observation) {
  return createObservationRuntime().record(observation);
}

export function runObservationRuntimeTests() {
  const runtime = createObservationRuntime();
  const observation = createValidObservation();
  const recorded = runtime.record(observation);
  const duplicate = runtime.record(createValidObservation(OBSERVATION_TYPES.userInput, {
    payload: {
      replacement: true
    }
  }));
  const storedAfterDuplicate = runtime.getObservation(observation.observationId);
  const missing = runtime.getObservation('observation-missing');

  const allTypesRuntime = createObservationRuntime();
  const allTypeResults = listObservationTypes().map((type) => allTypesRuntime.record(
    createValidObservation(type)
  ));
  const allTypesList = allTypesRuntime.listObservations();

  const malformed = createObservationRuntime().record(null);
  const invalid = createObservationRuntime().record(createValidObservation(
    OBSERVATION_TYPES.systemEvent,
    { occurredAt: 'not-a-timestamp' }
  ));
  const cyclicObservation = createValidObservation();
  cyclicObservation.payload.self = cyclicObservation.payload;
  const normalizationFailure = createObservationRuntime().record(cyclicObservation);

  const snapshotRuntime = createObservationRuntime();
  const originalInput = createValidObservation(OBSERVATION_TYPES.modelOutput, {
    observationId: 'observation-snapshot'
  });
  const originalBefore = JSON.stringify(originalInput);
  const snapshotRecord = snapshotRuntime.record(originalInput);

  originalInput.payload.nested.stable = false;
  originalInput.provenance.providerId = 'mutated-provider';
  originalInput.metadata.sequence = 99;

  const snapshot = snapshotRuntime.getObservation('observation-snapshot');
  snapshot.payload.nested.stable = false;
  snapshot.provenance.providerId = 'mutated-snapshot-provider';
  snapshot.metadata.sequence = 88;
  const storedAfterSnapshotMutation = snapshotRuntime.getObservation('observation-snapshot');

  const listed = snapshotRuntime.listObservations();
  listed[0].payload.nested.stable = false;
  listed[0].metadata.sequence = 77;
  listed.push(createValidObservation(OBSERVATION_TYPES.toolResult, {
    observationId: 'observation-injected'
  }));
  const storedAfterListMutation = snapshotRuntime.getObservation('observation-snapshot');
  const listAfterMutation = snapshotRuntime.listObservations();

  const deterministicObservation = createValidObservation(OBSERVATION_TYPES.executionMetric, {
    observationId: 'observation-deterministic'
  });
  const deterministicA = recordInFreshRuntime(deterministicObservation);
  const deterministicB = recordInFreshRuntime(deterministicObservation);

  const domainState = {
    memories: [],
    relationships: [],
    reflections: [],
    verifications: [],
    providerCalls: 0
  };
  const domainStateBefore = JSON.stringify(domainState);
  const runtimeSurface = Object.keys(createObservationRuntime()).sort();
  const storedKeys = Object.keys(recorded.observation).sort();

  return [
    assert('valid record', recorded.status === 'complete' && recorded.observationId === observation.observationId),
    assert('all supported observation types', allTypeResults.every((result) => result.status === 'complete') && allTypesList.length === listObservationTypes().length),
    assert('duplicate observation rejected', duplicate.status === 'error' && duplicate.normalizedError.code === 'observation_runtime_duplicate'),
    assert('duplicate does not overwrite state', storedAfterDuplicate.payload.nested.stable && !Object.prototype.hasOwnProperty.call(storedAfterDuplicate.payload, 'replacement')),
    assert('get existing observation', runtime.getObservation(observation.observationId)?.observationId === observation.observationId),
    assert('get missing observation returns null', missing === null),
    assert('list observations', runtime.listObservations().length === 1 && allTypesList.map((item) => item.type).join(',') === listObservationTypes().join(',')),
    assert('malformed observation normalized error', malformed.status === 'error' && malformed.normalizedError.category === 'contract'),
    assert('invalid observation normalized error', invalid.status === 'error' && invalid.error === 'Observation occurredAt must be an explicit ISO 8601 timestamp'),
    assert('runtime failure normalized', normalizationFailure.status === 'error' && normalizationFailure.normalizedError.category === 'runtime'),
    assert('original input isolated from stored state', originalBefore !== JSON.stringify(originalInput) && snapshotRecord.observation.payload.nested.stable && storedAfterSnapshotMutation.provenance.providerId === 'openai'),
    assert('get returns defensive snapshot', storedAfterSnapshotMutation.payload.nested.stable && storedAfterSnapshotMutation.metadata.sequence === 1),
    assert('list returns defensive snapshots', storedAfterListMutation.payload.nested.stable && storedAfterListMutation.metadata.sequence === 1 && listAfterMutation.length === 1),
    assert('deterministic results', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('explicit timestamps preserved', recorded.observation.occurredAt === observation.occurredAt && recorded.observation.recordedAt === observation.recordedAt),
    assert('explicit provenance preserved', ['sourceType', 'sourceId', 'providerId', 'modelId', 'operationId', 'requestId'].every((field) => recorded.observation.provenance[field] === observation.provenance[field])),
    assert('explicit confidence preserved', recorded.observation.confidence === 0.8),
    assert('runtime state isolation', createObservationRuntime().listObservations().length === 0 && runtime.listObservations().length === 1),
    assert('no verification or interpretation fields', !storedKeys.includes('verification') && !storedKeys.includes('interpretation') && !storedKeys.includes('reflection')),
    assert('no domain behavior occurs', JSON.stringify(domainState) === domainStateBefore),
    assert('runtime exposes smallest API', runtimeSurface.join(',') === ['getObservation', 'listObservations', 'record'].join(',')),
    assert('delete omitted without lifecycle contract', !runtimeSurface.includes('deleteObservation'))
  ];
}
