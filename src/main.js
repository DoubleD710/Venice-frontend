import { createWaterCanvas } from './canvas/water.js';
import { initFusionBox } from './components/fusion-box.js';
import { initModeToggle } from './components/mode-toggle.js';
import { initProviderSettingsPanel } from './components/provider-settings-panel.js';
import { initResponsePanel } from './components/response-panel.js';
import { initDebugOverlay } from './components/debug-overlay.js';
import { createTokenStream } from './utils/token-stream.js';
import { clearConversation, loadConversation, saveConversation } from './utils/conversation-store.js';
import { getDefaultProvider, getProvider } from './utils/provider-registry.js';
import { loadProviderSettings } from './utils/provider-settings.js';

// App entrypoint: keep startup wiring visible and easy to follow.
const water = createWaterCanvas(document.querySelector('[data-water-canvas]'));
const fusionBox = document.querySelector('[data-fusion-box]');
const responsePanel = initResponsePanel(document.querySelector('[data-response-panel]'));
const tokenStream = createTokenStream(fusionBox);
const debugOverlay = initDebugOverlay();
const fusion = initFusionBox(fusionBox);
initProviderSettingsPanel(document.querySelector('[data-provider-settings]'));
let savedMessages = loadConversation();
let activeMessage = null;
let activeResponse = '';
const debugState = {
  provider: 'None',
  providerType: 'local',
  model: '',
  state: 'idle',
  tokenCount: 0,
  duration: '0.0s',
  timeToFirstToken: '0.0s',
  chunkCount: 0,
  byteCount: 0,
  malformedChunkCount: 0,
  fps: 0,
  rippleCount: 0,
  visualMode: document.documentElement.dataset.visualMode || 'silver',
  endpointHost: 'Not connected'
};

function formatDuration(duration) {
  return `${(duration / 1000).toFixed(1)}s`;
}

function updateDebugOverlay(nextState) {
  Object.assign(debugState, nextState);
  debugOverlay.update(debugState);
}

initModeToggle(document.querySelector('[data-mode-toggle]'));

function getEndpointHost(endpointUrl) {
  try {
    return new URL(endpointUrl).host;
  } catch {
    return endpointUrl || 'Not connected';
  }
}

function getSelectedProviderSummary() {
  const settings = loadProviderSettings();
  const provider = getProvider(settings.selectedProvider) || getDefaultProvider();

  return {
    provider: provider.label,
    providerType: provider.type,
    model: settings.models[provider.id] || provider.defaultModel,
    endpointHost: getEndpointHost(settings.endpoints[provider.id] || provider.defaultEndpoint)
  };
}

function buildTranscript(messages) {
  return messages
    .map((message) => `You: ${message.prompt}\n\nVenice: ${message.response}`)
    .join('\n\n---\n\n');
}

function restoreConversation() {
  if (!responsePanel || savedMessages.length === 0) {
    return;
  }

  const latestMessage = savedMessages[savedMessages.length - 1];

  responsePanel.open();
  responsePanel.setStreaming(false);
  responsePanel.setStatus('Restored');
  responsePanel.setContent(buildTranscript(savedMessages));
  fusion?.setPrompt(latestMessage.prompt);
  updateDebugOverlay({
    provider: latestMessage.provider.name,
    providerType: latestMessage.provider.type || 'local',
    model: latestMessage.provider.model || '',
    state: latestMessage.state,
    tokenCount: latestMessage.response.split(/\s+/).filter(Boolean).length,
    duration: '0.0s',
    endpointHost: latestMessage.provider.endpointHost || getEndpointHost(latestMessage.provider.endpointUrl)
  });
}

function startActiveMessage(prompt) {
  const startedAt = new Date().toISOString();

  activeResponse = '';
  activeMessage = {
    prompt,
    response: '',
    timestamps: {
      startedAt,
      completedAt: ''
    },
    provider: {
      name: 'None',
      type: 'local',
      model: '',
      endpointHost: 'Connecting'
    },
    state: 'streaming'
  };
}

function updateActiveMessage(status) {
  if (!activeMessage) {
    return;
  }

  activeMessage.state = status.state || activeMessage.state;
  activeMessage.provider = {
    name: status.provider || activeMessage.provider.name,
    type: status.providerType || activeMessage.provider.type,
    model: status.model || activeMessage.provider.model,
    endpointHost: getEndpointHost(status.endpointUrl) || activeMessage.provider.endpointHost
  };
}

function completeActiveMessage(status) {
  if (!activeMessage) {
    return;
  }

  updateActiveMessage(status);
  activeMessage.response = activeResponse;
  activeMessage.state = status.state;
  activeMessage.timestamps.completedAt = new Date().toISOString();

  savedMessages = [...savedMessages, activeMessage];
  saveConversation(savedMessages);
  activeMessage = null;
  activeResponse = '';
}

document.documentElement.addEventListener('venice:visual-mode', (event) => {
  updateDebugOverlay({ visualMode: event.detail.mode });
});

water.onStats((stats) => {
  updateDebugOverlay({
    fps: stats.fps,
    rippleCount: stats.rippleCount
  });
});

document.addEventListener('venice:provider-settings-saved', (event) => {
  updateDebugOverlay({
    provider: event.detail.provider,
    providerType: event.detail.providerType,
    model: event.detail.model,
    endpointHost: getEndpointHost(event.detail.endpointUrl)
  });
});

document.addEventListener('venice:ripple', (event) => {
  water.ripple(event.detail.x, event.detail.y, event.detail.strength);
});

document.addEventListener('venice:send', (event) => {
  if (!responsePanel) {
    return;
  }

  startActiveMessage(event.detail.prompt);
  responsePanel.open();
  responsePanel.clear();
  responsePanel.setStatus('Connecting');
  updateDebugOverlay({
    provider: 'None',
    providerType: 'local',
    model: '',
    state: 'streaming',
    tokenCount: 0,
    duration: '0.0s',
    timeToFirstToken: '0.0s',
    chunkCount: 0,
    byteCount: 0,
    malformedChunkCount: 0,
    endpointHost: 'Connecting'
  });

  tokenStream.start(event.detail.prompt, {
    onStart() {
      responsePanel.setStreaming(true);
    },
    onStatus(status) {
      updateActiveMessage(status);
      responsePanel.setStatus(status.message || status.state);
      updateDebugOverlay({
        provider: status.provider,
        providerType: status.providerType,
        model: status.model,
        state: status.state,
        tokenCount: status.tokenCount,
        duration: formatDuration(status.duration),
        endpointHost: getEndpointHost(status.endpointUrl)
      });
    },
    onValidation(validation) {
      if (!validation.ok) {
        responsePanel.setStatus(validation.errors[0]);
      }
    },
    onMetrics(metrics) {
      updateDebugOverlay({
        tokenCount: metrics.tokenCount,
        duration: formatDuration(metrics.duration)
      });
    },
    onDiagnostics(diagnostics) {
      updateDebugOverlay({
        chunkCount: diagnostics.chunkCount,
        byteCount: diagnostics.byteCount,
        malformedChunkCount: diagnostics.malformedChunkCount,
        timeToFirstToken: formatDuration(diagnostics.timeToFirstToken),
        duration: formatDuration(diagnostics.duration)
      });
    },
    onToken(token) {
      activeResponse += token;
      responsePanel.appendToken(token);
    },
    onToolCall(toolCall) {
      responsePanel.setStatus(`Tool call parsed: ${toolCall.name || 'unnamed'}`);
      updateDebugOverlay({
        state: 'tool_call'
      });
    },
    onDone(status) {
      completeActiveMessage(status);
      responsePanel.setStreaming(false);
      responsePanel.setStatus(status.message || 'Complete');
    },
    onStop(status) {
      updateActiveMessage(status);
      activeMessage = null;
      activeResponse = '';
      responsePanel.setStreaming(false);
      responsePanel.setStatus(status.message || 'Stopped');
    },
    onError(status) {
      updateActiveMessage(status);
      activeMessage = null;
      activeResponse = '';
      responsePanel.setStreaming(false);
      responsePanel.clear();
      responsePanel.appendToken(status.message);
    }
  });
});

document.addEventListener('venice:stop-generation', () => {
  if (!responsePanel) {
    return;
  }

  tokenStream.stop();
});

document.addEventListener('venice:clear-conversation', () => {
  tokenStream.stop();
  clearConversation();
  savedMessages = [];
  activeMessage = null;
  activeResponse = '';

  fusion?.setPrompt('');
  responsePanel?.clear();
  responsePanel?.setStreaming(false);
  responsePanel?.setStatus('Idle');
  updateDebugOverlay({
    provider: 'None',
    providerType: 'local',
    model: '',
    state: 'idle',
    tokenCount: 0,
    duration: '0.0s',
    timeToFirstToken: '0.0s',
    chunkCount: 0,
    byteCount: 0,
    malformedChunkCount: 0,
    endpointHost: 'Not connected'
  });
});

updateDebugOverlay(getSelectedProviderSummary());
restoreConversation();
water.start();
