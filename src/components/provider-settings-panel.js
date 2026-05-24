import { getProvider, isCloudProvider, listProviders } from '../utils/provider-registry.js';
import {
  getProviderCredential,
  loadProviderSettings,
  maskApiKey,
  saveProviderSettings,
  setProviderCredential
} from '../utils/provider-settings.js';
import { getProviderValidationMessage, validateProviderRuntime } from '../utils/provider-validation.js';

function getSummary(providerId, settings) {
  const provider = getProvider(providerId);

  return {
    providerId,
    provider: provider?.label || 'Unknown',
    providerType: provider?.type || 'local',
    model: settings.models[providerId] || provider?.defaultModel || '',
    endpointUrl: settings.endpoints[providerId] || provider?.defaultEndpoint || ''
  };
}

// Owns the compact provider settings form and never exposes API key values.
export function initProviderSettingsPanel(element) {
  if (!element) {
    return null;
  }

  const select = element.querySelector('[data-provider-select]');
  const modelInput = element.querySelector('[data-provider-model]');
  const endpointInput = element.querySelector('[data-provider-endpoint]');
  const apiKeyGroup = element.querySelector('[data-api-key-group]');
  const apiKeyInput = element.querySelector('[data-provider-api-key]');
  const apiKeyStatus = element.querySelector('[data-api-key-status]');
  const saveButton = element.querySelector('[data-save-provider-settings]');
  const clearKeyButton = element.querySelector('[data-clear-provider-key]');

  function dispatchChange(providerId, settings) {
    element.dispatchEvent(new CustomEvent('venice:provider-settings-saved', {
      bubbles: true,
      detail: getSummary(providerId, settings)
    }));
  }

  function fillProviders() {
    if (!select || select.options.length > 0) {
      return;
    }

    listProviders().forEach((provider) => {
      const option = document.createElement('option');

      option.value = provider.id;
      option.textContent = provider.label;
      select.appendChild(option);
    });
  }

  function hydrate(providerId = loadProviderSettings().selectedProvider) {
    const settings = loadProviderSettings();
    const provider = getProvider(providerId);

    if (!provider) {
      return;
    }

    if (!select || !modelInput || !endpointInput || !apiKeyGroup || !apiKeyInput || !apiKeyStatus || !clearKeyButton) {
      return;
    }

    select.value = provider.id;
    modelInput.value = settings.models[provider.id] || provider.defaultModel;
    endpointInput.value = settings.endpoints[provider.id] || provider.defaultEndpoint;

    const needsKey = isCloudProvider(provider.id);
    const savedKey = getProviderCredential(provider.id);
    const validation = validateProviderRuntime({
      provider,
      model: modelInput.value,
      endpoint: endpointInput.value,
      apiKey: savedKey
    });

    apiKeyGroup.hidden = !needsKey;
    clearKeyButton.hidden = !needsKey;
    apiKeyInput.value = '';
    apiKeyInput.placeholder = needsKey ? 'Paste API key to replace saved key' : '';
    apiKeyStatus.textContent = needsKey && savedKey
      ? maskApiKey(savedKey)
      : getProviderValidationMessage(validation);
  }

  function save() {
    if (!select || !modelInput || !endpointInput || !apiKeyInput) {
      return;
    }

    const settings = loadProviderSettings();
    const providerId = select.value;
    const provider = getProvider(providerId);

    if (!provider) {
      return;
    }

    settings.selectedProvider = providerId;
    settings.models[providerId] = modelInput.value.trim() || provider.defaultModel;
    settings.endpoints[providerId] = endpointInput.value.trim() || provider.defaultEndpoint;
    saveProviderSettings(settings);

    if (isCloudProvider(providerId) && apiKeyInput.value.trim()) {
      setProviderCredential(providerId, apiKeyInput.value.trim());
    }

    hydrate(providerId);
    dispatchChange(providerId, loadProviderSettings());
  }

  function clearKey() {
    if (!select) {
      return;
    }

    const providerId = select.value;

    setProviderCredential(providerId, '');
    hydrate(providerId);
    dispatchChange(providerId, loadProviderSettings());
  }

  fillProviders();
  hydrate();

  select?.addEventListener('change', () => {
    hydrate(select.value);
  });

  saveButton?.addEventListener('click', save);
  clearKeyButton?.addEventListener('click', clearKey);

  return {
    element,
    hydrate
  };
}
