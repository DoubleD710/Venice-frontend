export const MEMORY_ADMISSION_STATUS = {
  accepted: 'accepted',
  rejected: 'rejected',
  duplicate: 'duplicate',
  error: 'error'
};

export const MEMORY_ADMISSION_PHASES = {
  received: 'received',
  scored: 'scored',
  duplicateChecked: 'duplicate_checked',
  decided: 'decided',
  error: 'error'
};

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function createAdmissionScore({
  confidence = 0,
  importance = 0,
  novelty = 1,
  weighted = 0,
  metadata = {}
} = {}) {
  return {
    confidence: clampScore(confidence),
    importance: clampScore(importance),
    novelty: clampScore(novelty),
    weighted: clampScore(weighted),
    metadata
  };
}

export function createAdmissionEvent(phase, detail = {}) {
  return {
    type: 'memory_admission_event',
    phase,
    timestamp: new Date().toISOString(),
    ...detail
  };
}

export function createAdmissionDecision({
  candidate,
  status,
  score,
  reason = '',
  duplicateOf = '',
  metadata = {}
} = {}) {
  return {
    type: 'memory_admission_decision',
    status,
    candidate,
    score,
    reason,
    duplicateOf,
    metadata
  };
}

export function createAdmissionError(message, detail = {}) {
  return {
    type: 'memory_admission_decision',
    status: MEMORY_ADMISSION_STATUS.error,
    candidate: detail.candidate || null,
    score: null,
    reason: message,
    duplicateOf: '',
    metadata: detail.metadata || {}
  };
}
