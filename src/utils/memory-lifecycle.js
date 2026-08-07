import { isValidMemoryLifecycleState, MEMORY_LIFECYCLE_STATES } from './memory-types.js';

const ALLOWED_TRANSITIONS = {
  [MEMORY_LIFECYCLE_STATES.candidate]: [
    MEMORY_LIFECYCLE_STATES.accepted,
    MEMORY_LIFECYCLE_STATES.archived,
    MEMORY_LIFECYCLE_STATES.deleted
  ],
  [MEMORY_LIFECYCLE_STATES.accepted]: [
    MEMORY_LIFECYCLE_STATES.merged,
    MEMORY_LIFECYCLE_STATES.archived,
    MEMORY_LIFECYCLE_STATES.deleted
  ],
  [MEMORY_LIFECYCLE_STATES.merged]: [
    MEMORY_LIFECYCLE_STATES.archived,
    MEMORY_LIFECYCLE_STATES.deleted
  ],
  [MEMORY_LIFECYCLE_STATES.archived]: [
    MEMORY_LIFECYCLE_STATES.deleted
  ],
  [MEMORY_LIFECYCLE_STATES.deleted]: []
};

export function canTransitionMemoryState(fromState, toState) {
  if (!isValidMemoryLifecycleState(fromState) || !isValidMemoryLifecycleState(toState)) {
    return false;
  }

  if (fromState === toState) {
    return true;
  }

  return (ALLOWED_TRANSITIONS[fromState] || []).includes(toState);
}

export function transitionMemoryCard(card, nextState, metadata = {}) {
  if (!card) {
    return {
      ok: false,
      card: null,
      errors: ['Memory card is required']
    };
  }

  if (!canTransitionMemoryState(card.lifecycleState, nextState)) {
    return {
      ok: false,
      card,
      errors: [`Cannot transition memory card from ${card.lifecycleState} to ${nextState}`]
    };
  }

  return {
    ok: true,
    card: {
      ...card,
      lifecycleState: nextState,
      metadata: {
        ...card.metadata,
        lifecycle: {
          ...(card.metadata?.lifecycle || {}),
          lastTransition: {
            from: card.lifecycleState,
            to: nextState,
            ...metadata
          }
        }
      }
    },
    errors: []
  };
}
