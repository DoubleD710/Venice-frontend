import { negotiateProviderCapabilities } from './provider-capabilities.js';
import { createModelRegistry } from './model-registry.js';
import { resolveModel } from './model-resolution.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

export function runModelRegistryTests() {
  const registry = createModelRegistry([]);
  const registration = registry.registerModel({
    id: 'test-model',
    providerId: 'openai',
    name: 'Test Model',
    capabilities: {
      streaming: true,
      tools: true,
      json: true,
      vision: false,
      embeddings: false,
      reasoning: false
    },
    contextWindow: 4096,
    pricingMetadata: {
      source: 'test'
    },
    modalityMetadata: {
      input: ['text'],
      output: ['text']
    },
    status: 'available'
  });

  const registeredModel = registry.getModel('openai', 'test-model');
  const localResolution = resolveModel('ollama', 'llama3.2');
  const cloudResolution = resolveModel('openai', 'gpt-4o-mini');
  const unknownModel = resolveModel('openai', 'future-model');
  const unknownProvider = resolveModel('unknown-provider', 'missing-model');
  const negotiated = negotiateProviderCapabilities('openai', {
    modelId: 'gpt-4o-mini',
    streaming: true,
    tools: true,
    json: true,
    vision: true
  });
  const localNegotiated = negotiateProviderCapabilities('ollama', {
    modelId: 'llama3.2',
    streaming: true,
    tools: true
  });

  return [
    assert('model registration', registration.ok && registeredModel?.id === 'test-model'),
    assert('model resolution', cloudResolution.ok && cloudResolution.model.id === 'gpt-4o-mini'),
    assert('unknown model handling', unknownModel.ok && !unknownModel.registered && unknownModel.model.status === 'unregistered'),
    assert('unknown provider handling', !unknownProvider.ok && unknownProvider.errors[0] === 'Unknown provider'),
    assert('capability resolution', negotiated.enabled.tools && negotiated.enabled.json && negotiated.enabled.vision),
    assert('unsupported local capability remains disabled', localNegotiated.ok && !localNegotiated.enabled.tools),
    assert('local model metadata', localResolution.model.providerId === 'ollama' && localResolution.model.pricingMetadata.source === 'local'),
    assert('cloud model metadata', cloudResolution.model.providerId === 'openai' && cloudResolution.model.contextWindow === 128000)
  ];
}
