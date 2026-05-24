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
- `provider-settings.js` owns localStorage-backed provider settings and credentials.
- `provider-validation.js` performs preflight checks before any provider request.
- `local-llm.js` and `cloud-llm.js` own fetch transport.
- `stream-normalizer.js` turns provider-specific stream chunks into Venice events.
- `stream-diagnostics.js` tracks safe stream counters and timing for observability.
- `tool-call-normalizer.js` parses tool calls but does not execute them yet.

Tool calling is intentionally parse-only in this phase. Future safe tool execution should live behind explicit allowlists and user-controlled execution boundaries.
