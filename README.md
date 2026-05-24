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

Venice streams from local HTTP endpoints:

- Ollama: `http://localhost:11434/api/generate`
- llama.cpp: `http://localhost:8080/completion`

Optional browser settings:

- `localStorage.setItem('venice:ollama-model', 'llama3.2')`
- `localStorage.setItem('venice:ollama-url', 'http://localhost:11434/api/generate')`
- `localStorage.setItem('venice:llama-url', 'http://localhost:8080/completion')`

## Architecture Notes

Keep modules readable and focused. Prefer canvas for atmospheric effects, keep DOM interactions small, and avoid abstractions until they remove real repetition or clarify ownership.
