export const TOOL_LIFECYCLE = {
  requested: 'requested',
  validated: 'validated',
  permissionChecked: 'permission_checked',
  started: 'started',
  completed: 'completed',
  denied: 'denied',
  error: 'error'
};

export const TOOL_RESULT_TYPES = {
  success: 'success',
  error: 'error'
};

export function createToolEvent(phase, request, detail = {}) {
  return {
    type: 'tool_event',
    phase,
    callId: request.callId,
    toolId: request.toolId,
    timestamp: new Date().toISOString(),
    ...detail
  };
}

export function createToolResult(request, result, timing) {
  return {
    type: 'tool_result',
    status: TOOL_RESULT_TYPES.success,
    callId: request.callId,
    toolId: request.toolId,
    result,
    startedAt: timing.startedAt,
    completedAt: timing.completedAt,
    duration: timing.duration
  };
}

export function createToolError(request, message, timing = {}) {
  return {
    type: 'tool_result',
    status: TOOL_RESULT_TYPES.error,
    callId: request.callId,
    toolId: request.toolId,
    error: message,
    startedAt: timing.startedAt || '',
    completedAt: timing.completedAt || new Date().toISOString(),
    duration: timing.duration || 0
  };
}

export function parseToolArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {
      value: rawArguments
    };
  }
}

export function normalizeToolRequest(toolCall) {
  const toolId = toolCall.name || toolCall.toolId || '';

  return {
    callId: toolCall.id || `tool-${Date.now()}`,
    toolId,
    provider: toolCall.provider || 'unknown',
    input: parseToolArguments(toolCall.arguments),
    raw: toolCall.raw || toolCall
  };
}

export function validateToolContract(tool) {
  const errors = [];

  if (!tool?.id) {
    errors.push('Tool id is required');
  }

  if (!tool?.name) {
    errors.push('Tool name is required');
  }

  if (!tool?.description) {
    errors.push('Tool description is required');
  }

  if (!tool?.capabilities || typeof tool.capabilities !== 'object') {
    errors.push('Tool capabilities are required');
  }

  if (typeof tool?.execute !== 'function') {
    errors.push('Tool execute(input) function is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateToolInput(tool, input) {
  if (input === null || Array.isArray(input) || typeof input !== 'object') {
    return {
      ok: false,
      errors: ['Tool input must be an object']
    };
  }

  if (typeof tool.validateInput === 'function') {
    return tool.validateInput(input);
  }

  return {
    ok: true,
    errors: []
  };
}
