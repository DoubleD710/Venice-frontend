# Venice Frontend

Venice is a cinematic local-first AI WebUI experiment built with plain HTML, CSS, and JavaScript.

## Project Shape

- `src/index.html` is the browser entrypoint.
- `src/main.js` wires the small modules together.
- `src/styles/` holds global styles and focused visual systems.
- `src/components/` holds lightweight UI behavior modules.
- `src/canvas/` owns canvas-based environmental rendering.
- `src/utils/` holds small shared helpers.

## Running Locally

Open `src/index.html` directly in a browser. There is no build step, package install, framework, or dependency setup.

Venice streams from these provider endpoints by default:

- Ollama: `http://localhost:11434/api/generate`
- llama.cpp: `http://localhost:8080/completion`
- OpenAI: `https://api.openai.com/v1/chat/completions`
- xAI: `https://api.x.ai/v1/chat/completions`
- DeepSeek: `https://api.deepseek.com/chat/completions`

Use the provider settings surface in the app to choose a provider, model, endpoint, and cloud API key.

Completed conversations are saved in localStorage and restored on reload. Use the response panel's Clear action to remove the saved conversation from this browser.

Provider settings are also saved in localStorage, including cloud API keys for local/private testing. Do not use browser-stored API keys in hosted or public deployments. A deployed Venice build should use a backend proxy, OS keychain-style secure storage, or another server-side secret boundary.

## Architecture Notes

Keep modules readable and focused. Prefer canvas for atmospheric effects, keep DOM interactions small, and avoid abstractions until they remove real repetition or clarify ownership.

Provider architecture is split away from UI code:

- `provider-registry.js` defines local and cloud provider capabilities.
- `model-contracts.js` defines provider-agnostic model metadata.
- `model-registry.js` registers local and cloud models.
- `model-resolution.js` resolves selected provider/model pairs before capability negotiation.
- `provider-capabilities.js` negotiates requested features against resolved model metadata and provider transport support.
- `provider-settings.js` owns localStorage-backed provider settings and credentials.
- `provider-validation.js` performs preflight checks before any provider request.
- `local-llm.js` and `cloud-llm.js` own fetch transport.
- `stream-normalizer.js` turns provider-specific stream chunks into Venice events.
- `stream-diagnostics.js` tracks safe stream counters and timing for observability.
- `embedding-contracts.js` defines normalized embedding requests, vectors, lifecycle events, and results.
- `embedding-provider-registry.js` owns embedding transport adapter metadata.
- `embedding-runtime.js` validates embedding-capable models, requests vectors, and normalizes embedding results.
- `recall-contracts.js`, `recall-result.js`, and `recall-runtime.js` rank in-memory candidates and assemble context packages without storage.
- `memory-types.js`, `memory-candidate.js`, `memory-card.js`, and `memory-contracts.js` define memory shapes only.
- `memory-admission-contracts.js` and `memory-admission.js` score and accept/reject memory candidates before lifecycle handling.
- `memory-events.js`, `memory-lifecycle.js`, and `memory-runtime.js` own in-memory memory lifecycle behavior only; no storage or retrieval is implemented.
- `memory-operation-contracts.js` and `memory-operations.js` define proposed deterministic memory state changes only; operations are validated but never executed.
- `memory-operation-executor.js` dispatches validated memory operations into Memory Runtime. The executor does not own memory state; Memory Runtime is the only in-memory mutation authority.
- `relationship-types.js` and `relationship-contracts.js` define inert memory relationship shapes only. There is no relationship runtime, graph, traversal, persistence, or mutation behavior yet.
- `relationship-operation-contracts.js` and `relationship-operations.js` define inert proposals for future relationship mutations. They validate contracts and emit proposal lifecycle events without executing changes.
- `tool-call-normalizer.js` parses provider tool requests without executing them.
- `tool-contracts.js` defines normalized tool requests, lifecycle events, and results.
- `tool-registry.js` owns the small built-in tool list.
- `tool-runtime.js` validates, permission-checks, executes, and reports tool lifecycle events.

Tool execution is intentionally narrow in this phase. The runtime includes calculator, current-time, and diagnostics-snapshot tools only. There are no agents, autonomous loops, shell tools, filesystem mutation tools, or browser automation tools.

Future tool systems should plug in through the registry, permission hook, and sandbox hook instead of changing provider transports or UI modules. Providers may request tool calls; the execution layer decides whether they run.

## Venice v0.1 Memory Flow

Memory Operation -> Contract Validation -> Memory Operation Executor -> Execution Preconditions -> Memory Runtime -> In-Memory State -> Normalized Result / Events / Error.

Memory Operations normalize and propose deterministic state changes. Contract Validation is pure, deterministic, and state-independent: it checks shape, operation type, enum values, field types, `operationId`, optional `idempotencyKey`, and merge policy syntax. It does not inspect runtime state.

Memory Operation Executor validates state-dependent execution preconditions and dispatches only. It owns no memory state, does not reason, and does not mutate runtime maps directly. Memory Runtime is the only in-memory mutation authority; it owns memory records, lifecycle state, deterministic mutation behavior, and safe snapshots through `getCard()` / `listCards()`.

Merge policy is explicit. v0.1 supports only `target_wins`; missing policy and unsupported policies are rejected deterministically. Merge does not infer precedence from timestamps, argument order, insertion order, source names, or field values.

`expire` is soft expiration: the card remains present, transitions to archived lifecycle state, and carries explicit expiration metadata. `delete` removes the card from active in-memory state. `update` is not upsert; missing cards fail with a normalized error.

`operationId` identifies one operation instance. `idempotencyKey` is optional and identifies repeated submissions that represent the same intended effect. v0.1 preserves both through validation, executor events, results, and errors, but does not implement replay suppression, dedupe storage, or global uniqueness enforcement.

This v0.1 Memory Core has no Admission wiring, Recall, Reflection, Relationship Runtime, graph traversal, Persistence, Embeddings, Providers, UI integration, Planner, Research Runtime, Conversation Compiler integration, filesystem access, network access, database access, or vector DB access.

## Relationship Contracts

Memory Card -> Relationship Contract -> Relationship Operation -> future Relationship Operation Executor -> future Relationship Runtime.

Relationship Contracts define the normalized language for future links between memory cards. They are inert contract objects only: no graph exists yet, no traversal exists yet, no persistence exists yet, and no mutation occurs in this layer.

Relationship Operations describe proposed `link`, `unlink`, `strengthen`, and `weaken` mutations. They are inert mutation proposals: validation is pure and state-independent, no operation is executed, and no relationship or graph state exists in this layer.
