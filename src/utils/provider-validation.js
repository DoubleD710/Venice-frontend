import { getProvider, isCloudProvider } from './provider-registry.js';
import { negotiateProviderCapabilities } from './provider-capabilities.js';
import { resolveModel } from './model-resolution.js';

function isHttpEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProviderRuntime({ provider, model, endpoint, apiKey, requestedCapabilities = {} }) {
  const errors = [];
  const warnings = [];
  const knownProvider = provider ? getProvider(provider.id) : null;
  const modelResolution = resolveModel(provider?.id, model);
  const negotiatedCapabilities = negotiateProviderCapabilities(provider?.id, {
    ...requestedCapabilities,
    modelId: model
  }, modelResolution);

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

  errors.push(...negotiatedCapabilities.errors);
  warnings.push(...negotiatedCapabilities.warnings);
  errors.push(...modelResolution.errors);

  if (knownProvider && isCloudProvider(knownProvider.id) && !apiKey) {
    errors.push(`${knownProvider.label} API key is required`);
  }

  if (knownProvider?.type === 'local' && endpoint?.startsWith('https://')) {
    warnings.push('Local providers usually use localhost http endpoints');
  }

  const uniqueErrors = Array.from(new Set(errors));
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    capabilities: negotiatedCapabilities,
    modelResolution
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
