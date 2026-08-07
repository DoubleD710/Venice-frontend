import {
  createMemoryCard,
  createMemoryCandidate,
  createMemoryCardFromCandidate,
  isValidMemoryLifecycleState,
  isValidMemoryType,
  MEMORY_LIFECYCLE_STATES,
  MEMORY_TYPES,
  validateMemoryCard,
  validateMemoryCandidate,
  validateMemoryObject
} from './memory-contracts.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

export function runMemoryContractTests() {
  const candidate = createMemoryCandidate({
    id: 'candidate-1',
    source: 'session:1',
    category: MEMORY_TYPES.preference,
    confidence: 0.84,
    evidence: ['User prefers local-first tools'],
    metadata: {
      turnId: 'turn-1'
    }
  });
  const card = createMemoryCard({
    id: 'card-1',
    type: MEMORY_TYPES.preference,
    confidence: 0.84,
    freshness: 0.9,
    summary: 'User prefers local-first tools.',
    tags: ['local-first'],
    evidence: candidate.evidence,
    metadata: {
      source: candidate.source
    },
    lifecycleState: MEMORY_LIFECYCLE_STATES.accepted
  });
  const candidateCard = createMemoryCardFromCandidate(candidate, {
    id: 'card-from-candidate',
    summary: 'Candidate converted to a card.'
  });
  const malformedCard = {
    id: '',
    type: 'invalid',
    confidence: 2,
    freshness: -1,
    summary: 7,
    tags: 'tag',
    evidence: 'evidence',
    metadata: [],
    lifecycleState: 'missing'
  };
  const malformedCandidate = {
    id: '',
    source: '',
    category: 'invalid',
    confidence: -1,
    evidence: {},
    metadata: []
  };

  return [
    assert('memory card validation', validateMemoryCard(card).ok),
    assert('memory candidate validation', validateMemoryCandidate(candidate).ok),
    assert('memory type validation', isValidMemoryType(MEMORY_TYPES.project) && !isValidMemoryType('invalid')),
    assert('lifecycle validation', isValidMemoryLifecycleState(MEMORY_LIFECYCLE_STATES.archived) && !isValidMemoryLifecycleState('invalid')),
    assert('malformed memory card handling', !validateMemoryCard(malformedCard).ok && validateMemoryCard(malformedCard).errors.length > 0),
    assert('malformed memory candidate handling', !validateMemoryCandidate(malformedCandidate).ok && validateMemoryCandidate(malformedCandidate).errors.length > 0),
    assert('generic object validation', validateMemoryObject(card).ok && validateMemoryObject(candidate).ok && !validateMemoryObject(null).ok),
    assert('candidate to card shape', candidateCard.lifecycleState === MEMORY_LIFECYCLE_STATES.candidate && candidateCard.metadata.candidateId === candidate.id)
  ];
}
