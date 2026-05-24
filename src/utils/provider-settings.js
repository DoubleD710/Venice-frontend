import { getDefaultProvider, getProvider, isCloudProvider, listProviders } from './provider-registry.js';

const STORAGE_KEY = 'venice:provider-settings:v1';

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDefaultSettings() {
  const models = {};
  const endpoints = {};
  const apiKeys = {};

  listProviders().forEach((provider) => {
    models[provider.id] = provider.defaultModel;
    endpoints[provider.id] = provider.defaultEndpoint;
  });

  return {
    selectedProvider: getDefaultProvider().id,
    models,
    endpoints,
    apiKeys
  };
}

function normalizeSettings(settings) {
  const defaults = createDefaultSettings();
  const selectedProvider = getProvider(settings?.selectedProvider)
    ? settings.selectedProvider
    : defaults.selectedProvider;

  return {
    selectedProvider,
    models: {
      ...defaults.models,
      ...(settings?.models || {})
    },
    endpoints: {
      ...defaults.endpoints,
      ...(settings?.endpoints || {})
    },
    apiKeys: {
      ...(settings?.apiKeys || {})
    }
  };
}

export function saveProviderSettings(settings) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function loadProviderSettings() {
  const storage = getStorage();

  if (!storage) {
    return createDefaultSettings();
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createDefaultSettings();
    }

    return normalizeSettings(JSON.parse(rawValue));
  } catch {
    return createDefaultSettings();
  }
}

export function clearProviderSettings() {
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

export function getProviderCredential(providerId) {
  if (!isCloudProvider(providerId)) {
    return '';
  }

  return loadProviderSettings().apiKeys[providerId] || '';
}

export function setProviderCredential(providerId, apiKey) {
  if (!isCloudProvider(providerId)) {
    return false;
  }

  const settings = loadProviderSettings();

  if (apiKey) {
    settings.apiKeys[providerId] = apiKey;
  } else {
    delete settings.apiKeys[providerId];
  }

  return saveProviderSettings(settings);
}

export function maskApiKey(apiKey) {
  if (!apiKey) {
    return 'No key saved';
  }

  return `Saved key: ...${apiKey.slice(-4)}`;
}
