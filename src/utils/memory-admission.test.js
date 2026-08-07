import { createMemoryAdmissionRuntime } from './memory-admission.js';
import { MEMORY_TYPES } from './memory-types.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    source: 'session:1',
    category: MEMORY_TYPES.preference,
    confidence: 0.85,
    evidence: ['User prefers local-first software'],
    metadata: {
      turnId: 'turn-1'
    },
    ...overrides
  };
}

export function runMemoryAdmissionTests() {
  const runtime = createMemoryAdmissionRuntime();
  const events = [];

  runtime.onEvent((event) => {
    events.push(event);
  });

  const accepted = runtime.decide(createCandidate());
  const rejected = runtime.decide(createCandidate({
    id: 'candidate-2',
    source: 'session:2',
    confidence: 0.2,
    evidence: ['Weak signal']
  }));
  const duplicate = runtime.decide(createCandidate({
    id: 'candidate-3'
  }));
  const invalid = runtime.decide({
    id: 'candidate-4',
    source: '',
    category: MEMORY_TYPES.preference,
    confidence: 0.8,
    evidence: []
  });
  const important = runtime.decide(createCandidate({
    id: 'candidate-5',
    source: 'session:5',
    category: MEMORY_TYPES.user,
    confidence: 0.9,
    evidence: ['User identity signal', 'Repeated personal preference', 'Explicit statement']
  }));

  return [
    assert('acceptance test', accepted.status === 'accepted'),
    assert('rejection test', rejected.status === 'rejected' && rejected.reason === 'Candidate confidence is below threshold'),
    assert('duplicate test', duplicate.status === 'duplicate' && duplicate.duplicateOf === accepted.candidate.id),
    assert('confidence scoring test', accepted.score.confidence === 0.85),
    assert('importance scoring test', important.score.importance > accepted.score.importance),
    assert('normalized error test', invalid.status === 'error' && invalid.reason === 'Memory candidate source is required'),
    assert('event emission test', events.some((event) => event.phase === 'decided'))
  ];
}
