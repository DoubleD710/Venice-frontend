import { createToolRuntime } from './tool-runtime.js';
import { createToolRegistry } from './tool-registry.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

export async function runToolRuntimeTests() {
  const registry = createToolRegistry();
  const events = [];
  const registryResult = registry.registerTool({
    id: 'echo',
    name: 'echo',
    description: 'Echoes input.',
    capabilities: {
      permissions: []
    },
    validateInput(input) {
      return {
        ok: typeof input.text === 'string',
        errors: typeof input.text === 'string' ? [] : ['text is required']
      };
    },
    execute(input) {
      return { text: input.text };
    }
  });

  const runtime = createToolRuntime({ registry });
  runtime.onEvent((event) => events.push(event));

  const success = await runtime.executeTool({
    id: 'call-1',
    name: 'echo',
    arguments: '{"text":"hello"}'
  });

  const invalidInput = await runtime.executeTool({
    id: 'call-2',
    name: 'echo',
    arguments: '{"value":"missing"}'
  });

  const unknownTool = await runtime.executeTool({
    id: 'call-3',
    name: 'missing',
    arguments: '{}'
  });

  const deniedRuntime = createToolRuntime({
    registry,
    permissionHook() {
      return {
        allowed: false,
        reason: 'Denied by test hook'
      };
    }
  });
  const denied = await deniedRuntime.executeTool({
    id: 'call-4',
    name: 'echo',
    arguments: '{"text":"blocked"}'
  });

  return [
    assert('tool registration', registryResult.ok && registry.listTools().length === 1),
    assert('tool execution', success.status === 'success' && success.result.text === 'hello'),
    assert('tool validation', invalidInput.status === 'error' && invalidInput.error === 'text is required'),
    assert('normalized unknown tool error', unknownTool.status === 'error' && unknownTool.error === 'Unknown tool: missing'),
    assert('permission hook compatibility', denied.status === 'error' && denied.error === 'Denied by test hook'),
    assert('lifecycle events', events.some((event) => event.phase === 'completed'))
  ];
}
