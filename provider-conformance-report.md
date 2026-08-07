# Venice Provider Conformance Report

This document defines the normalized provider contract used by Venice's Execution Layer. Provider adapters may parse different upstream response formats, but they should emit the same normalized event shapes before UI or runtime orchestration sees them.

## Normalized Event Contract

### Token Event

```js
{
  type: 'token',
  text: 'partial response text'
}
```

Rules:
- `text` is always a string.
- Empty provider deltas should not emit token events.

### Status Event

```js
{
  type: 'status',
  state: 'streaming',
  message: 'Streaming from Provider',
  provider: 'Provider label',
  providerId: 'provider-id',
  providerType: 'local',
  endpointUrl: 'http://localhost:11434/api/generate',
  model: 'model-name'
}
```

Rules:
- `state` is one of the lifecycle states owned by `request-state.js`.
- Abort/cancel resolves to `state: 'stopped'`.
- Status events may describe transport progress, but must not enforce policy.

### Completion Event

```js
{
  type: 'complete',
  usage: {
    provider: 'provider-id',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    raw: {}
  }
}
```

Rules:
- `usage` is always present.
- Unknown counts are `null`, not omitted.
- `raw` preserves provider metadata when available and is `null` when unavailable.

### Error Event

```js
{
  type: 'error',
  error: 'Human-readable failure'
}
```

Rules:
- Errors are normalized to a string message.
- Provider-specific error bodies stay inside adapter code.
- Abort/cancel should become stopped status at the transport boundary when possible.

### Tool Call Event

```js
{
  type: 'tool_call',
  toolCall: {
    id: 'provider-call-id',
    provider: 'provider-id',
    name: 'tool-name',
    arguments: '{}',
    raw: {}
  }
}
```

Rules:
- Tool calls are requests only.
- Providers never execute tools.
- Tool Runtime decides whether a tool call is valid, permitted, and executable.

## Provider Audit

### OpenAI

- Stream format: Server-sent `data:` lines with OpenAI chat-completion chunks.
- Tool calls: `choices[].delta.tool_calls` or `choices[].message.tool_calls`.
- Abort behavior: fetch aborts and stream-reader aborts become stopped status in `cloud-llm.js`.
- Metadata: `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens`.
- Capabilities: streaming, tools, and JSON mode are advertised.
- Translation required: SSE stripping, `[DONE]` handling, tool-call extraction, usage key normalization.

### xAI

- Stream format: OpenAI-compatible SSE chat-completion chunks.
- Tool calls: OpenAI-compatible `tool_calls` shape.
- Abort behavior: same cloud fetch path as OpenAI.
- Metadata: OpenAI-compatible usage fields when provided.
- Capabilities: streaming, tools, and JSON mode are advertised.
- Translation required: same OpenAI-compatible adapter path; provider id must remain `xai`.

### DeepSeek

- Stream format: OpenAI-compatible SSE chat-completion chunks.
- Tool calls: OpenAI-compatible `tool_calls` shape.
- Abort behavior: same cloud fetch path as OpenAI.
- Metadata: OpenAI-compatible usage fields when provided.
- Capabilities: streaming, tools, and JSON mode are advertised.
- Translation required: same OpenAI-compatible adapter path; provider id must remain `deepseek`.

### Ollama

- Stream format: JSON lines from `/api/generate`.
- Tool calls: not currently advertised for this Venice adapter.
- Abort behavior: local fetch aborts become stopped status in `local-llm.js`.
- Metadata: `prompt_eval_count` and `eval_count`.
- Capabilities: streaming only; tool calls are warned and disabled by negotiation.
- Translation required: JSON-line parsing, `response` token extraction, `done` completion handling, eval-count usage normalization.

## Capability Negotiation

Capability negotiation must remain pure and capability-only:
- Same provider id plus same requested capability object returns identical output.
- Unknown providers return `ok: false`, no enabled capabilities, and a safe error.
- Unsupported optional capabilities produce warnings and remain disabled.
- Policy decisions belong to validation, runtime permissions, or future sandbox layers.

## Current Adapter Fixes

- Completion usage metadata now has one normalized shape across OpenAI, xAI, DeepSeek, llama.cpp, and Ollama.
- Local status events now include `type: 'status'` to match cloud status events.
- Cloud abort handling no longer emits `error: undefined` on stopped status.
- Cloud stream-reader aborts now emit stopped status instead of a string-matched error.
- Tool-call parsing remains provider-agnostic and execution-free.

## Conformance Suite

The suite lives in `src/utils/provider-conformance.js` and exports:

```js
runProviderConformanceTests()
```

It verifies:
- token, completion, error, and tool-call event shapes
- normalized usage metadata
- cloud/local abort status shape
- capability negotiation purity and safe degradation
- unsupported tool capability gating for Ollama

The suite uses mocked chunks and mocked fetch aborts. It does not contact provider endpoints and does not add any dependencies or build tooling.
