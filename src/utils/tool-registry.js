import { validateToolContract } from './tool-contracts.js';

function createCalculatorTool() {
  const tokenPattern = /\d+(?:\.\d+)?|\.\d+|[()+\-*/%]/g;

  function calculate(expression) {
    const compactExpression = expression.replace(/\s+/g, '');
    const tokens = compactExpression.match(tokenPattern) || [];
    let position = 0;

    if (tokens.join('') !== compactExpression) {
      throw new Error('Calculator supports only numbers and arithmetic operators');
    }

    function readToken() {
      return tokens[position];
    }

    function consumeToken() {
      const token = tokens[position];
      position += 1;
      return token;
    }

    function parseFactor() {
      const token = readToken();

      if (token === '-') {
        consumeToken();
        return -parseFactor();
      }

      if (token === '(') {
        consumeToken();
        const value = parseExpression();

        if (consumeToken() !== ')') {
          throw new Error('Calculator expression has mismatched parentheses');
        }

        return value;
      }

      consumeToken();
      const value = Number(token);

      if (!Number.isFinite(value)) {
        throw new Error('Calculator expression contains an invalid number');
      }

      return value;
    }

    function parseTerm() {
      let value = parseFactor();

      while (['*', '/', '%'].includes(readToken())) {
        const operator = consumeToken();
        const nextValue = parseFactor();

        if (operator === '*') {
          value *= nextValue;
        }

        if (operator === '/') {
          value /= nextValue;
        }

        if (operator === '%') {
          value %= nextValue;
        }
      }

      return value;
    }

    function parseExpression() {
      let value = parseTerm();

      while (['+', '-'].includes(readToken())) {
        const operator = consumeToken();
        const nextValue = parseTerm();

        value = operator === '+'
          ? value + nextValue
          : value - nextValue;
      }

      return value;
    }

    const result = parseExpression();

    if (position !== tokens.length) {
      throw new Error('Calculator expression is incomplete');
    }

    if (!Number.isFinite(result)) {
      throw new Error('Calculator result is not finite');
    }

    return result;
  }

  return {
    id: 'calculator',
    name: 'calculator',
    description: 'Evaluates a basic arithmetic expression.',
    capabilities: {
      category: 'utility',
      permissions: [],
      deterministic: true
    },
    validateInput(input) {
      return {
        ok: typeof input.expression === 'string' && input.expression.trim().length > 0,
        errors: typeof input.expression === 'string' && input.expression.trim().length > 0
          ? []
          : ['Calculator requires an expression string']
      };
    },
    execute(input) {
      const expression = input.expression.trim();

      return {
        expression,
        value: calculate(expression)
      };
    }
  };
}

function createCurrentTimeTool() {
  return {
    id: 'current-time',
    name: 'current-time',
    description: 'Returns the current local time.',
    capabilities: {
      category: 'utility',
      permissions: [],
      deterministic: false
    },
    execute() {
      const now = new Date();

      return {
        iso: now.toISOString(),
        local: now.toLocaleString()
      };
    }
  };
}

function createDiagnosticsSnapshotTool() {
  return {
    id: 'diagnostics-snapshot',
    name: 'diagnostics-snapshot',
    description: 'Returns a safe snapshot of current Venice diagnostics.',
    capabilities: {
      category: 'observability',
      permissions: [],
      deterministic: false
    },
    execute(input, context = {}) {
      return {
        diagnostics: context.diagnosticsSnapshot || {}
      };
    }
  };
}

export function createToolRegistry() {
  const tools = new Map();

  function registerTool(tool) {
    const validation = validateToolContract(tool);

    if (!validation.ok) {
      return {
        ok: false,
        errors: validation.errors
      };
    }

    tools.set(tool.id, tool);

    return {
      ok: true,
      errors: []
    };
  }

  function getTool(id) {
    return tools.get(id) || null;
  }

  function listTools() {
    return Array.from(tools.values()).map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      capabilities: { ...tool.capabilities }
    }));
  }

  return {
    registerTool,
    getTool,
    listTools
  };
}

export function createDefaultToolRegistry() {
  const registry = createToolRegistry();

  registry.registerTool(createCalculatorTool());
  registry.registerTool(createCurrentTimeTool());
  registry.registerTool(createDiagnosticsSnapshotTool());

  return registry;
}
