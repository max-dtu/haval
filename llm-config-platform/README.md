# LLM Config Platform

A browser-first, plugin-based config builder that renders provider-specific forms from JavaScript, validates input, and produces a unified request object.

## What is included

- Plugin architecture for providers in `src/plugins`.
- Registry and request pipeline in `src/core`.
- Validation and normalization utilities.
- Dynamic tab/panel UI in `src/ui`.
- Diff engine that highlights config changes between submissions.

## Run

Serve this folder with any static server and open `index.html`.

Example:

```bash
cd llm-config-platform
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Integration

The app auto-mounts when it finds `#model-picker-root` in the page.

```html
<link rel="stylesheet" href="./llm-config-platform/styles/main.css" />
<script type="module" src="./llm-config-platform/src/ui/app.js" defer></script>
<div id="model-picker-root"></div>
```

