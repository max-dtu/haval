# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development

- Start the dev server: `go run server.go` — serves the repo root on http://localhost:8080.
- There is no build system or test suite. Stylelint with BEM pattern enforcement is available for CSS linting (`npm run lint:css`). All code is vanilla HTML/CSS/JS (ES modules) and a tiny Go static file server.
- Open individual modules directly via the Go server, e.g.:
  - http://localhost:8080/threads/
  - http://localhost:8080/llm-config/
  - http://localhost:8080/model-lab/

## Architecture Overview

The repo contains four independent browser modules plus a Go static file server. There is no shared bundler or framework.

### LLM Config Platform (`llm-config/`)

A plugin-based config builder that accepts provider settings as JSON, validates input, preserves provider-specific extras, and shows the generated request transparently.

- **Plugin architecture**: Each LLM provider is a plugin object with `id`, `fields`, `normalize(config)`, `toRequest(config)`, and `supported_features`.
- **Plugin interface enforcement**: `src/core/pluginInterface.js` validates shape at registration time (`assertPluginShape`).
- **Registry**: `src/core/registry.js` holds all registered plugins (`register`, `get`, `list`).
- **Unified request builder**: `src/core/unifiedRequest.js` orchestrates normalization (`plugin.normalize`), validation (`validateConfig`), and request generation (`plugin.toRequest`). It returns a structured result with `ok`, `user_entered_config`, `normalized_config`, `supported_features`, and `what_will_be_sent`.
- **Validation**: `src/validation/validator.js` runs per-field checks (`required`, `type`, `min`, `max`, `url`) against `plugin.fields`. Extra keys are preserved but not validated.
- **Normalization**: `src/utils/normalize.js` applies per-field defaults and types, then copies unknown keys via `deepClone`.
- **Catalog**: `src/providers/catalog.js` registers all plugins (`webllm`, `ollama`, `remote`, `openai`, `anthropic`, `huggingface`, `vllm`).
- **Remote plugin inheritance**: `openai` and other providers extend `remotePlugin` by spreading it and overriding `id`/`normalize`/`toRequest`.

### Threads (`threads/`)

A thread-based chat UI with sidebar list, expandable chat panels, and OPFS persistence.

- **State**: `threads.js` holds `state.db`, `state.threads[]`, `state.activeThreadId`, `state.availableModels`, and `state.searchQuery`.
- **OPFS schema** (`storage.js`): Two object stores — `threads` (keyPath `id`, index on `updatedAt`) and `messages` (keyPath `id`, indexes on `threadId` and `threadIdCreatedAt`).
- **Migration path**: `storage.js` migrates legacy `localStorage` (`haval.threads.v1`) into OPFS on first load if the DB is empty.
- **Sanitization**: `threadHelpers.js` (`createThreadSanitizer`) normalizes loaded threads — validates `id`, `createdAt`, `updatedAt`, `selectedModel`, `messages[]`, and `isOpen`. Invalid threads are dropped.
- **Persistence rule**: A thread is only persisted if it has at least one message (`shouldPersistThread`). Empty threads are pruned on hydration.
- **Rendering**: `view.js` is pure DOM rendering with no state mutation. `renderThreadList` and `renderThreadPanels` are called after every state change.
- **Model picker integration**: The "Open Config" button in a thread panel opens `llm-config/index.html` in a `<dialog>` iframe with query params `?thread={id}&selected={model}`.

### Model Lab (`model-lab/`)

An educational browser module that trains a tiny char-level LSTM with TensorFlow.js and intercepts chat API calls for stats.

- **Fetch interceptor**: `model-lab.js` wraps `window.fetch` to capture calls to `*/api/chat`, measuring TTFB, input/output token estimates, and session totals.
- **TF.js lazy loading**: TensorFlow.js is loaded from CDN only when the user clicks Train.
- **Training pipeline**: Embedding → LSTM → Dense+Softmax. Logs include color-coded tags: `info`, `learn`, `train`, `milestone`, `weights`, `memory`, `sample`, `warn`, `experiment`, `error`.
- **Hyperparameters**: hidden units, learning rate, sequence length, steps, temperature.

### Lang Lab (`lang-lab/`)

A chat interface where users can interact with WebLLM models directly in the browser.

- **WebLLM integration**: Loads and runs models entirely client-side using WebLLM (via `@mlc-ai/web-llm`).
- **Browser storage**: Conversations are persisted using Web SQLite (sqlite3 WASM & origin-private file system).
- **Module entry**: `lang-lab/index.html`

## Code Conventions (from `principles.md`)

- **HTML**: Build self-contained reusable components. Use semantic tags. Attach `data-action` and `data-state` attributes when JS interaction is needed.
- **CSS**: Mobile-first responsive design. Use BEM for all class names. No IDs for styling. No inline styles.
- **JavaScript**: Keep code modular (small functions). Avoid global variables. Target elements using `data-action`, not classes or IDs (IDs are reserved for accessibility anchors). Event-driven design. Keep it minimal.
- **Views / core logic separation**: Business logic must be independent of any view layer. No DOM, CLI, or formatting inside core logic. Core modules return structured data (objects/JSON), not UI output. External consumers choose their own interface.

## Important Notes

- All inter-module navigation happens through the Go static file server; there is no router or bundler.
- `threads/` reads model presets from `localStorage` key `haval.model-presets.v1` to populate the `<select>` in each thread panel.
- The `remote` plugin is the base for OpenAI-style HTTP APIs. Provider-specific fields beyond the declared `fields` array are preserved and passed through to the final request.
