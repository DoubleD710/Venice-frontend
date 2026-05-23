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

## Architecture Notes

Keep modules readable and focused. Prefer canvas for atmospheric effects, keep DOM interactions small, and avoid abstractions until they remove real repetition or clarify ownership.
