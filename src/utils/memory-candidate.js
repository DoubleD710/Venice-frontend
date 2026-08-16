import { isValidMemoryType, MEMORY_TYPES } from './memory-types.js';

function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function normalizeConfidence(confidence) {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence));
}

function normalizeEvidence(evidence = []) {
  return Array.isArray(evidence) ? [...evidence] : [evidence];
}

function normalizeMetadata(metadata = {}) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? JSON.parse(JSON.stringify(metadata))
    : {};
}

export function createMemoryCandidate({
  id = createId('memory-candidate'),
  source = '',
  category = MEMORY_TYPES.session,
  confidence = 0,
  evidence = [],
  metadata = {}
} = {}) {
  return {
    id,
    source,
    category,
    confidence: normalizeConfidence(confidence),
    evidence: normalizeEvidence(evidence),
    metadata: normalizeMetadata(metadata)
  };
}

export function validateMemoryCandidate(candidate) {
  const errors = [];

  if (!candidate?.id) {
    errors.push('Memory candidate id is required');
  }

  if (!candidate?.source) {
    errors.push('Memory candidate source is required');
  }

  if (!isValidMemoryType(candidate?.category)) {
    errors.push('Memory candidate category is invalid');
  }

  if (!Number.isFinite(candidate?.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    errors.push('Memory candidate confidence must be between 0 and 1');
  }

  if (!Array.isArray(candidate?.evidence)) {
    errors.push('Memory candidate evidence must be an array');
  }

  if (!candidate?.metadata || typeof candidate.metadata !== 'object' || Array.isArray(candidate.metadata)) {
    errors.push('Memory candidate metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
