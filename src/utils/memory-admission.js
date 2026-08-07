import { createMemoryCandidate, validateMemoryCandidate } from './memory-candidate.js';
import { MEMORY_TYPES } from './memory-types.js';
import {
  createAdmissionDecision,
  createAdmissionError,
  createAdmissionEvent,
  createAdmissionScore,
  MEMORY_ADMISSION_PHASES,
  MEMORY_ADMISSION_STATUS
} from './memory-admission-contracts.js';

const DEFAULT_IMPORTANCE_BY_TYPE = {
  [MEMORY_TYPES.session]: 0.35,
  [MEMORY_TYPES.working]: 0.5,
  [MEMORY_TYPES.project]: 0.7,
  [MEMORY_TYPES.user]: 0.8,
  [MEMORY_TYPES.task]: 0.65,
  [MEMORY_TYPES.preference]: 0.85,
  [MEMORY_TYPES.knowledge]: 0.75
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getCandidateFingerprint(candidate) {
  return [
    candidate.category,
    candidate.source,
    normalizeText(candidate.evidence.join(' '))
  ].join('|');
}

function getEvidenceStrength(candidate) {
  return Math.min(1, candidate.evidence.filter(Boolean).length / 3);
}

function calculateImportance(candidate) {
  const baseImportance = DEFAULT_IMPORTANCE_BY_TYPE[candidate.category] || 0.4;
  const evidenceBoost = getEvidenceStrength(candidate) * 0.15;

  return Math.min(1, baseImportance + evidenceBoost);
}

function calculateWeightedScore({ confidence, importance, novelty }) {
  return confidence * 0.45 + importance * 0.4 + novelty * 0.15;
}

function createAcceptedDecision(candidate, score) {
  return createAdmissionDecision({
    candidate,
    status: MEMORY_ADMISSION_STATUS.accepted,
    score,
    reason: 'Candidate passed admission thresholds'
  });
}

function createRejectedDecision(candidate, score, reason) {
  return createAdmissionDecision({
    candidate,
    status: MEMORY_ADMISSION_STATUS.rejected,
    score,
    reason
  });
}

function createDuplicateDecision(candidate, score, duplicateOf) {
  return createAdmissionDecision({
    candidate,
    status: MEMORY_ADMISSION_STATUS.duplicate,
    score,
    reason: 'Candidate duplicates an existing admission candidate',
    duplicateOf
  });
}

export function createMemoryAdmissionRuntime(options = {}) {
  const acceptedFingerprints = new Map();
  const listeners = new Set();
  const thresholds = {
    confidence: 0.5,
    importance: 0.45,
    weighted: 0.55,
    ...(options.thresholds || {})
  };
  let decisionCount = 0;
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

  function scoreCandidate(candidate, novelty = 1) {
    const confidence = candidate.confidence;
    const importance = calculateImportance(candidate);

    return createAdmissionScore({
      confidence,
      importance,
      novelty,
      weighted: calculateWeightedScore({ confidence, importance, novelty }),
      metadata: {
        evidenceCount: candidate.evidence.length
      }
    });
  }

  function decide(candidateInput = {}) {
    const candidate = createMemoryCandidate(candidateInput);

    emit(createAdmissionEvent(MEMORY_ADMISSION_PHASES.received, {
      candidateId: candidate.id
    }));

    const validation = validateMemoryCandidate(candidate);

    if (!validation.ok) {
      const result = createAdmissionError(validation.errors[0], {
        candidate
      });

      emit(createAdmissionEvent(MEMORY_ADMISSION_PHASES.error, {
        candidateId: candidate.id,
        message: result.reason
      }));
      return result;
    }

    const fingerprint = getCandidateFingerprint(candidate);
    const duplicateOf = acceptedFingerprints.get(fingerprint) || '';
    const novelty = duplicateOf ? 0 : 1;
    const score = scoreCandidate(candidate, novelty);

    emit(createAdmissionEvent(MEMORY_ADMISSION_PHASES.scored, {
      candidateId: candidate.id,
      score
    }));
    emit(createAdmissionEvent(MEMORY_ADMISSION_PHASES.duplicateChecked, {
      candidateId: candidate.id,
      duplicateOf
    }));

    let decision;

    if (duplicateOf) {
      decision = createDuplicateDecision(candidate, score, duplicateOf);
    } else if (score.confidence < thresholds.confidence) {
      decision = createRejectedDecision(candidate, score, 'Candidate confidence is below threshold');
    } else if (score.importance < thresholds.importance) {
      decision = createRejectedDecision(candidate, score, 'Candidate importance is below threshold');
    } else if (score.weighted < thresholds.weighted) {
      decision = createRejectedDecision(candidate, score, 'Candidate weighted score is below threshold');
    } else {
      decision = createAcceptedDecision(candidate, score);
      acceptedFingerprints.set(fingerprint, candidate.id);
    }

    decisionCount += 1;
    lastStatus = decision.status;
    emit(createAdmissionEvent(MEMORY_ADMISSION_PHASES.decided, {
      candidateId: candidate.id,
      status: decision.status,
      duplicateOf: decision.duplicateOf
    }));

    return decision;
  }

  function getDiagnostics() {
    return {
      decisionCount,
      lastStatus,
      admittedFingerprintCount: acceptedFingerprints.size
    };
  }

  return {
    decide,
    scoreCandidate,
    onEvent,
    getDiagnostics
  };
}
