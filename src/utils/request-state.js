export const REQUEST_STATES = {
  idle: 'idle',
  streaming: 'streaming',
  stopped: 'stopped',
  error: 'error',
  complete: 'complete'
};

// Owns the generation lifecycle state.
export function createRequestState(initialState = REQUEST_STATES.idle) {
  let state = initialState;
  const listeners = new Set();

  function notify(message = '') {
    const snapshot = { state, message };

    listeners.forEach((listener) => listener(snapshot));
  }

  function setState(nextState, message = '') {
    state = nextState;
    notify(message);
  }

  function onChange(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getState() {
      return state;
    },
    setState,
    onChange
  };
}
