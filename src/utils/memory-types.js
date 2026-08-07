export const MEMORY_TYPES = {
  session: 'session',
  working: 'working',
  project: 'project',
  user: 'user',
  task: 'task',
  preference: 'preference',
  knowledge: 'knowledge'
};

export const MEMORY_LIFECYCLE_STATES = {
  candidate: 'candidate',
  accepted: 'accepted',
  merged: 'merged',
  archived: 'archived',
  deleted: 'deleted'
};

export function isValidMemoryType(type) {
  return Object.values(MEMORY_TYPES).includes(type);
}

export function isValidMemoryLifecycleState(state) {
  return Object.values(MEMORY_LIFECYCLE_STATES).includes(state);
}

export function listMemoryTypes() {
  return Object.values(MEMORY_TYPES);
}

export function listMemoryLifecycleStates() {
  return Object.values(MEMORY_LIFECYCLE_STATES);
}
