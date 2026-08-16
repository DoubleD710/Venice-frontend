import {
  isValidMemoryLifecycleState,
  isValidMemoryType,
  MEMORY_LIFECYCLE_STATES,
  MEMORY_TYPES
} from './memory-types.js';

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function normalizeBoundedScore(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [value].filter((item) => item !== undefined && item !== null);
}

function normalizeMetadata(metadata = {}) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? JSON.parse(JSON.stringify(metadata))
    : {};
}

export function createMemoryCard({
  id = createId('memory-card'),
  type = MEMORY_TYPES.session,
  confidence = 0,
  freshness = 1,
  summary = '',
  tags = [],
  evidence = [],
  metadata = {},
  lifecycleState = MEMORY_LIFECYCLE_STATES.candidate
} = {}) {
  return {
    id,
    type,
    confidence: normalizeBoundedScore(confidence),
    freshness: normalizeBoundedScore(freshness, 1),
    summary,
    tags: normalizeArray(tags),
    evidence: normalizeArray(evidence),
    metadata: normalizeMetadata(metadata),
    lifecycleState
  };
}

export function validateMemoryCard(card) {
  const errors = [];

  if (!card?.id) {
    errors.push('Memory card id is required');
  }

  if (!isValidMemoryType(card?.type)) {
    errors.push('Memory card type is invalid');
  }

  if (!Number.isFinite(card?.confidence) || card.confidence < 0 || card.confidence > 1) {
    errors.push('Memory card confidence must be between 0 and 1');
  }

  if (!Number.isFinite(card?.freshness) || card.freshness < 0 || card.freshness > 1) {
    errors.push('Memory card freshness must be between 0 and 1');
  }

  if (typeof card?.summary !== 'string') {
    errors.push('Memory card summary must be a string');
  }

  if (!Array.isArray(card?.tags)) {
    errors.push('Memory card tags must be an array');
  }

  if (!Array.isArray(card?.evidence)) {
    errors.push('Memory card evidence must be an array');
  }

  if (!card?.metadata || typeof card.metadata !== 'object' || Array.isArray(card.metadata)) {
    errors.push('Memory card metadata must be an object');
  }

  if (!isValidMemoryLifecycleState(card?.lifecycleState)) {
    errors.push('Memory card lifecycleState is invalid');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
