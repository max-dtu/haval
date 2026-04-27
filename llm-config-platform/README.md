# LLM Config Platform

A browser-first, plugin-based config builder that accepts provider settings as JSON, validates input, preserves provider-specific extras, and shows the generated request transparently.

The app exposes four layers so users can see exactly what is happening:

- `raw_config`: the JSON entered by the user
- `normalized_config`: the config after defaults and normalization
- `supported_features`: the platform's declared feature support for the selected provider
- `transformations`: the list of defaults, rewrites, and passthrough fields
- `provider_request`: the final provider-specific request payload

The default UI focuses on validation and transparent request generation. It does not compare submissions against earlier configs.
