export const OBSERVATION_TYPES = {
  userInput: 'user_input',
  modelOutput: 'model_output',
  toolStarted: 'tool_started',
  toolResult: 'tool_result',
  toolError: 'tool_error',
  systemEvent: 'system_event',
  executionMetric: 'execution_metric'
};

export function listObservationTypes() {
  return Object.values(OBSERVATION_TYPES);
}

export function isValidObservationType(type) {
  return listObservationTypes().includes(type);
}
