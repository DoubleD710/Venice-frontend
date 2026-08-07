import { createMemoryCard, validateMemoryCard } from './memory-card.js';
import { createMemoryCandidate, validateMemoryCandidate } from './memory-candidate.js';
import {
  isValidMemoryLifecycleState,
  isValidMemoryType,
  MEMORY_LIFECYCLE_STATES,
  MEMORY_TYPES
} from './memory-types.js';

export {
  createMemoryCard,
  createMemoryCandidate,
  isValidMemoryLifecycleState,
  isValidMemoryType,
  MEMORY_LIFECYCLE_STATES,
  MEMORY_TYPES,
  validateMemoryCard,
  validateMemoryCandidate
};

export function validateMemoryObject(memoryObject) {
  if (!memoryObject || typeof memoryObject !== 'object' || Array.isArray(memoryObject)) {
    return {
      ok: false,
      errors: ['Memory object must be an object']
    };
  }

  if (Object.prototype.hasOwnProperty.call(memoryObject, 'lifecycleState')) {
    return validateMemoryCard(memoryObject);
  }

  if (Object.prototype.hasOwnProperty.call(memoryObject, 'category')) {
    return validateMemoryCandidate(memoryObject);
  }

  return {
    ok: false,
    errors: ['Memory object shape is unknown']
  };
}

export function createMemoryCardFromCandidate(candidate, overrides = {}) {
  return createMemoryCard({
    type: candidate.category,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    metadata: {
      source: candidate.source,
      candidateId: candidate.id,
      ...candidate.metadata
    },
    lifecycleState: MEMORY_LIFECYCLE_STATES.candidate,
    ...overrides
  });
}
