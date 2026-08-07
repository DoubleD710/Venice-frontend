const STORAGE_KEY = 'venice:conversation:v1';
const MAX_MESSAGES = 40;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeMessage(message) {
  return {
    prompt: String(message?.prompt || ''),
    response: String(message?.response || ''),
    timestamps: {
      startedAt: message?.timestamps?.startedAt || '',
      completedAt: message?.timestamps?.completedAt || ''
    },
    provider: {
      id: message?.provider?.id || '',
      name: message?.provider?.name || 'None',
      type: message?.provider?.type || 'local',
      capabilities: message?.provider?.capabilities || '',
      model: message?.provider?.model || '',
      endpointHost: message?.provider?.endpointHost || '',
      endpointUrl: message?.provider?.endpointUrl || 'Not connected'
    },
    state: message?.state || 'complete'
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map(normalizeMessage)
    .filter((message) => message.prompt || message.response)
    .slice(-MAX_MESSAGES);
}

export function saveConversation(messages) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  const normalizedMessages = normalizeMessages(messages);
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    messages: normalizedMessages
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        ...payload,
        messages: normalizedMessages.slice(-10)
      }));
      return true;
    } catch {
      return false;
    }
  }
}

export function loadConversation() {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const payload = JSON.parse(rawValue);
    const messages = Array.isArray(payload) ? payload : payload.messages;

    return normalizeMessages(messages);
  } catch {
    return [];
  }
}

export function clearConversation() {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
