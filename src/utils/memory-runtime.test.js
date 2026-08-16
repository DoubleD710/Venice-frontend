import { createMemoryRuntime } from './memory-runtime.js';
import { MEMORY_LIFECYCLE_STATES, MEMORY_TYPES } from './memory-types.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createCandidate(id, evidence = 'Evidence') {
  return {
    id,
    source: `session:${id}`,
    category: MEMORY_TYPES.preference,
    confidence: 0.8,
    evidence: [evidence],
    metadata: {
      turnId: id
    }
  };
}

export function runMemoryRuntimeTests() {
  const runtime = createMemoryRuntime();
  const events = [];

  runtime.onEvent((event) => {
    events.push(event);
  });

  const intake = runtime.intakeCandidate(createCandidate('candidate-1'));
  const invalidCandidate = runtime.intakeCandidate({
    id: 'bad-candidate',
    source: '',
    category: MEMORY_TYPES.preference,
    confidence: 0.8,
    evidence: []
  });
  const createdCard = runtime.acceptCandidate('candidate-1', {
    id: 'card-1',
    summary: 'User prefers local-first systems.',
    tags: ['local-first']
  });
  const transitioned = runtime.expireCard('card-1', {
    expiresAt: '2026-08-13T00:00:00.000Z',
    reason: 'test'
  });
  const expiredStillPresent = runtime.getCard('card-1');
  const deleted = runtime.deleteCard('card-1');
  const deletedActiveCard = runtime.getCard('card-1');

  runtime.intakeCandidate(createCandidate('candidate-2', 'First merge evidence'));
  runtime.intakeCandidate(createCandidate('candidate-3', 'Second merge evidence'));

  const firstMergeCard = runtime.acceptCandidate('candidate-2', {
    id: 'merge-card-1',
    summary: 'Merge primary',
    tags: ['primary']
  });
  const secondMergeCard = runtime.acceptCandidate('candidate-3', {
    id: 'merge-card-2',
    summary: 'Merge secondary',
    tags: ['secondary']
  });
  const merged = runtime.mergeCards('merge-card-1', 'merge-card-2', {
    mergePolicy: 'target_wins'
  });
  const missing = runtime.archiveCard('missing-card');

  return [
    assert('candidate intake', intake.status === 'complete' && intake.candidate.id === 'candidate-1'),
    assert('candidate validation', invalidCandidate.status === 'error' && invalidCandidate.error === 'Memory candidate source is required'),
    assert('card creation', createdCard.status === 'complete' && createdCard.card.lifecycleState === MEMORY_LIFECYCLE_STATES.accepted),
    assert('soft expire transition', transitioned.card.lifecycleState === MEMORY_LIFECYCLE_STATES.archived && expiredStillPresent.metadata.lifecycle.lastTransition.expiration.expired),
    assert('delete removes active card', deleted.card.lifecycleState === MEMORY_LIFECYCLE_STATES.deleted && deletedActiveCard === null),
    assert('merge behavior', merged.status === 'complete' && merged.card.tags.includes('primary') && !merged.card.tags.includes('secondary') && merged.mergedCard.lifecycleState === MEMORY_LIFECYCLE_STATES.merged),
    assert('normalized error', missing.status === 'error' && missing.error === 'Memory card was not found'),
    assert('event emission', events.some((event) => event.phase === 'cards_merged')),
    assert('merge setup', firstMergeCard.status === 'complete' && secondMergeCard.status === 'complete')
  ];
}
