import {
  createToolError,
  createToolEvent,
  createToolResult,
  normalizeToolRequest,
  TOOL_LIFECYCLE,
  validateToolInput
} from './tool-contracts.js';
import { createDefaultToolRegistry } from './tool-registry.js';

function defaultPermissionHook({ tool }) {
  const permissions = tool.capabilities?.permissions || [];

  return {
    allowed: permissions.length === 0,
    reason: permissions.length === 0 ? 'Allowed' : 'Permission required'
  };
}

async function defaultSandboxHook({ tool, input, context }) {
  return tool.execute(input, context);
}

export function createToolRuntime(options = {}) {
  const registry = options.registry || createDefaultToolRegistry();
  const permissionHook = options.permissionHook || defaultPermissionHook;
  const sandboxHook = options.sandboxHook || defaultSandboxHook;
  const contextProvider = options.contextProvider || (() => ({}));
  const listeners = new Set();
  let executionCount = 0;
  let lastToolStatus = 'idle';

  function emit(event) {
    lastToolStatus = event.phase || lastToolStatus;
    listeners.forEach((listener) => listener(event));
  }

  function onEvent(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  async function executeTool(toolCall, context = {}) {
    const request = normalizeToolRequest(toolCall);
    const runtimeContext = {
      ...contextProvider(),
      ...context
    };
    const startedAtMs = performance.now();
    const startedAt = new Date().toISOString();

    emit(createToolEvent(TOOL_LIFECYCLE.requested, request));

    const tool = registry.getTool(request.toolId);

    if (!tool) {
      const result = createToolError(request, `Unknown tool: ${request.toolId}`, {
        startedAt,
        duration: performance.now() - startedAtMs
      });

      emit(createToolEvent(TOOL_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }

    const inputValidation = validateToolInput(tool, request.input);

    if (!inputValidation.ok) {
      const result = createToolError(request, inputValidation.errors[0], {
        startedAt,
        duration: performance.now() - startedAtMs
      });

      emit(createToolEvent(TOOL_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }

    emit(createToolEvent(TOOL_LIFECYCLE.validated, request));

    const permission = await permissionHook({ tool, request, context: runtimeContext });

    if (!permission.allowed) {
      const result = createToolError(request, permission.reason || 'Tool permission denied', {
        startedAt,
        duration: performance.now() - startedAtMs
      });

      emit(createToolEvent(TOOL_LIFECYCLE.denied, request, { message: result.error }));
      return result;
    }

    emit(createToolEvent(TOOL_LIFECYCLE.permissionChecked, request));
    emit(createToolEvent(TOOL_LIFECYCLE.started, request));

    try {
      const output = await sandboxHook({
        tool,
        input: request.input,
        request,
        context: runtimeContext
      });
      const completedAt = new Date().toISOString();
      const result = createToolResult(request, output, {
        startedAt,
        completedAt,
        duration: performance.now() - startedAtMs
      });

      executionCount += 1;
      emit(createToolEvent(TOOL_LIFECYCLE.completed, request));
      return result;
    } catch (error) {
      const result = createToolError(request, error.message || 'Tool execution failed', {
        startedAt,
        duration: performance.now() - startedAtMs
      });

      emit(createToolEvent(TOOL_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }
  }

  function getDiagnostics() {
    return {
      registeredTools: registry.listTools().length,
      executionCount,
      lastToolStatus
    };
  }

  return {
    registerTool: registry.registerTool,
    listTools: registry.listTools,
    executeTool,
    onEvent,
    getDiagnostics
  };
}
