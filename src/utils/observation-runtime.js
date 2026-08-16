import {
  normalizeObservation,
  validateObservation
} from './observation-contracts.js';

function snapshotObservation(observation) {
  return observation ? normalizeObservation(observation) : null;
}

function createNormalizedError(code, message, category) {
  return {
    code,
    message,
    category
  };
}

function createRuntimeResult(observation) {
  return {
    type: 'observation_runtime_result',
    status: 'complete',
    observationId: observation.observationId,
    observation: snapshotObservation(observation),
    error: '',
    normalizedError: null
  };
}

function createRuntimeError(message, observation = null, {
  code = 'observation_runtime_rejected',
  category = 'precondition'
} = {}) {
  return {
    type: 'observation_runtime_result',
    status: 'error',
    observationId: observation?.observationId || '',
    observation: null,
    error: message,
    normalizedError: createNormalizedError(code, message, category)
  };
}

export function createObservationRuntime() {
  const observations = new Map();

  function record(observationInput) {
    let observation;

    try {
      observation = normalizeObservation(observationInput);
    } catch {
      return createRuntimeError(
        'Observation could not be normalized',
        observationInput,
        {
          code: 'observation_runtime_normalization_error',
          category: 'runtime'
        }
      );
    }

    const validation = validateObservation(observation);

    if (!validation.ok) {
      return createRuntimeError(validation.errors[0], observation, {
        code: 'observation_runtime_invalid_observation',
        category: 'contract'
      });
    }

    if (observations.has(observation.observationId)) {
      return createRuntimeError('Observation already exists', observation, {
        code: 'observation_runtime_duplicate'
      });
    }

    observations.set(observation.observationId, observation);

    return createRuntimeResult(observation);
  }

  function getObservation(observationId) {
    return snapshotObservation(observations.get(observationId));
  }

  function listObservations() {
    return Array.from(observations.values()).map(snapshotObservation);
  }

  return {
    record,
    getObservation,
    listObservations
  };
}
