import {
  createMemoryCard,
  createMemoryCardFromCandidate,
  createMemoryCandidate,
  MEMORY_LIFECYCLE_STATES,
  validateMemoryCandidate,
  validateMemoryCard
} from './memory-contracts.js';
import { createMemoryError, createMemoryEvent, MEMORY_EVENT_PHASES } from './memory-events.js';
import { transitionMemoryCard } from './memory-lifecycle.js';

function normalizeError(error) {
  return error?.message || String(error || 'Memory runtime error');
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== '')));
}

function createSuccessResult(type, detail = {}) {
  return {
    type,
    status: 'complete',
    error: '',
    ...detail
  };
}

function areMergeCompatible(left, right) {
  const blockedStates = [
    MEMORY_LIFECYCLE_STATES.archived,
    MEMORY_LIFECYCLE_STATES.deleted
  ];

  return Boolean(
    left
      && right
      && left.type === right.type
      && !blockedStates.includes(left.lifecycleState)
      && !blockedStates.includes(right.lifecycleState)
  );
}

export function createMemoryRuntime() {
  const candidates = new Map();
  const cards = new Map();
  const listeners = new Set();
  let lastStatus = 'idle';

  function emit(event) {
    lastStatus = event.phase || lastStatus;
    listeners.forEach((listener) => listener(event));
  }

  function onEvent(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function intakeCandidate(candidateInput = {}) {
    const candidate = createMemoryCandidate(candidateInput);

    emit(createMemoryEvent(MEMORY_EVENT_PHASES.candidateReceived, {
      candidateId: candidate.id
    }));

    const validation = validateMemoryCandidate(candidate);

    if (!validation.ok) {
      const result = createMemoryError(validation.errors[0], {
        candidate
      });

      emit(createMemoryEvent(MEMORY_EVENT_PHASES.error, {
        candidateId: candidate.id,
        message: result.error
      }));
      return result;
    }

    candidates.set(candidate.id, candidate);
    emit(createMemoryEvent(MEMORY_EVENT_PHASES.candidateValidated, {
      candidateId: candidate.id
    }));

    return createSuccessResult('memory_candidate_result', {
      candidate
    });
  }

  function getCandidate(candidateOrId) {
    if (typeof candidateOrId === 'string') {
      return candidates.get(candidateOrId) || null;
    }

    return candidateOrId || null;
  }

  function acceptCandidate(candidateOrId, overrides = {}) {
    const candidate = getCandidate(candidateOrId);

    if (!candidate) {
      return createMemoryError('Memory candidate was not found');
    }

    const validation = validateMemoryCandidate(candidate);

    if (!validation.ok) {
      return createMemoryError(validation.errors[0], {
        candidate
      });
    }

    const card = createMemoryCardFromCandidate(candidate, {
      lifecycleState: MEMORY_LIFECYCLE_STATES.accepted,
      ...overrides
    });
    const cardValidation = validateMemoryCard(card);

    if (!cardValidation.ok) {
      return createMemoryError(cardValidation.errors[0], {
        card
      });
    }

    cards.set(card.id, card);
    emit(createMemoryEvent(MEMORY_EVENT_PHASES.cardCreated, {
      candidateId: candidate.id,
      cardId: card.id
    }));

    return createSuccessResult('memory_card_result', {
      card
    });
  }

  function transitionCard(cardId, nextState, metadata = {}) {
    const card = cards.get(cardId);

    if (!card) {
      return createMemoryError('Memory card was not found', {
        cardId
      });
    }

    const transition = transitionMemoryCard(card, nextState, metadata);

    if (!transition.ok) {
      return createMemoryError(transition.errors[0], {
        card
      });
    }

    cards.set(cardId, transition.card);
    emit(createMemoryEvent(MEMORY_EVENT_PHASES.lifecycleChanged, {
      cardId,
      from: card.lifecycleState,
      to: nextState
    }));

    return createSuccessResult('memory_card_result', {
      card: transition.card
    });
  }

  function mergeCards(primaryCardId, secondaryCardId, overrides = {}) {
    const primary = cards.get(primaryCardId);
    const secondary = cards.get(secondaryCardId);

    if (!primary || !secondary) {
      return createMemoryError('Both memory cards are required for merge', {
        primaryCardId,
        secondaryCardId
      });
    }

    if (!areMergeCompatible(primary, secondary)) {
      return createMemoryError('Memory cards are not merge compatible', {
        primary,
        secondary
      });
    }

    const mergedCard = createMemoryCard({
      ...primary,
      confidence: Math.max(primary.confidence, secondary.confidence),
      freshness: Math.max(primary.freshness, secondary.freshness),
      tags: uniqueValues([...primary.tags, ...secondary.tags]),
      evidence: uniqueValues([...primary.evidence, ...secondary.evidence]),
      metadata: {
        ...primary.metadata,
        mergedFrom: uniqueValues([
          ...(primary.metadata?.mergedFrom || []),
          secondary.id
        ])
      },
      ...overrides
    });
    const validation = validateMemoryCard(mergedCard);

    if (!validation.ok) {
      return createMemoryError(validation.errors[0], {
        card: mergedCard
      });
    }

    cards.set(primaryCardId, mergedCard);

    const secondaryTransition = transitionMemoryCard(secondary, MEMORY_LIFECYCLE_STATES.merged, {
      mergedInto: primaryCardId
    });

    if (secondaryTransition.ok) {
      cards.set(secondaryCardId, secondaryTransition.card);
    }

    emit(createMemoryEvent(MEMORY_EVENT_PHASES.cardsMerged, {
      primaryCardId,
      secondaryCardId
    }));

    return createSuccessResult('memory_merge_result', {
      card: mergedCard,
      mergedCard: secondaryTransition.card || secondary
    });
  }

  function archiveCard(cardId) {
    return transitionCard(cardId, MEMORY_LIFECYCLE_STATES.archived);
  }

  function deleteCard(cardId) {
    return transitionCard(cardId, MEMORY_LIFECYCLE_STATES.deleted);
  }

  function getDiagnostics() {
    return {
      candidateCount: candidates.size,
      cardCount: cards.size,
      lastStatus
    };
  }

  return {
    intakeCandidate,
    acceptCandidate,
    transitionCard,
    mergeCards,
    archiveCard,
    deleteCard,
    onEvent,
    getDiagnostics
  };
}
