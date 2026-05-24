const PROVIDERS = [
  {
    id: 'ollama',
    label: 'Ollama',
    type: 'local',
    defaultEndpoint: 'http://localhost:11434/api/generate',
    defaultModel: 'llama3.2',
    supportsStreaming: true,
    supportsTools: false,
    requestFormat: 'ollama-generate'
  },
  {
    id: 'llamaCpp',
    label: 'llama.cpp',
    type: 'local',
    defaultEndpoint: 'http://localhost:8080/completion',
    defaultModel: 'local-model',
    supportsStreaming: true,
    supportsTools: false,
    requestFormat: 'llama-cpp-completion'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    type: 'cloud',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    supportsStreaming: true,
    supportsTools: true,
    requestFormat: 'openai-chat-completions'
  },
  {
    id: 'xai',
    label: 'xAI',
    type: 'cloud',
    defaultEndpoint: 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-4.3',
    supportsStreaming: true,
    supportsTools: true,
    requestFormat: 'openai-chat-completions'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'cloud',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-v4-flash',
    supportsStreaming: true,
    supportsTools: true,
    requestFormat: 'openai-chat-completions'
  }
];

export function listProviders() {
  return PROVIDERS.map((provider) => ({ ...provider }));
}

export function getProvider(id) {
  return listProviders().find((provider) => provider.id === id) || null;
}

export function getDefaultProvider() {
  return { ...PROVIDERS[0] };
}

export function isCloudProvider(id) {
  return getProvider(id)?.type === 'cloud';
}
