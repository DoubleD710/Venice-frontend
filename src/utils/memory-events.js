export const MEMORY_EVENT_PHASES = {
  candidateReceived: 'candidate_received',
  candidateValidated: 'candidate_validated',
  cardCreated: 'card_created',
  lifecycleChanged: 'lifecycle_changed',
  cardsMerged: 'cards_merged',
  error: 'error'
};

export function createMemoryEvent(phase, detail = {}) {
  return {
    type: 'memory_event',
    phase,
    timestamp: new Date().toISOString(),
    ...detail
  };
}

export function createMemoryError(message, detail = {}) {
  return {
    type: 'memory_result',
    status: 'error',
    error: message,
    ...detail
  };
}
