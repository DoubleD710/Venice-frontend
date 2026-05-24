import { getProvider, isCloudProvider } from './provider-registry.js';

function isHttpEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProviderRuntime({ provider, model, endpoint, apiKey }) {
  const errors = [];
  const warnings = [];
  const knownProvider = provider ? getProvider(provider.id) : null;

  if (!knownProvider) {
    errors.push('Unknown provider');
  }

  if (!model || !model.trim()) {
    errors.push('Model is required');
  }

  if (!endpoint || !endpoint.trim()) {
    errors.push('Endpoint is required');
  } else if (!isHttpEndpoint(endpoint)) {
    errors.push('Endpoint must be an http or https URL');
  }

  if (knownProvider && !knownProvider.supportsStreaming) {
    errors.push(`${knownProvider.label} does not support streaming`);
  }

  if (knownProvider && isCloudProvider(knownProvider.id) && !apiKey) {
    errors.push(`${knownProvider.label} API key is required`);
  }

  if (knownProvider?.type === 'local' && endpoint?.startsWith('https://')) {
    warnings.push('Local providers usually use localhost http endpoints');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

export function getProviderValidationMessage(validation) {
  if (validation.ok && validation.warnings.length === 0) {
    return 'Provider ready';
  }

  if (validation.errors.length > 0) {
    return validation.errors[0];
  }

  return validation.warnings[0];
}
