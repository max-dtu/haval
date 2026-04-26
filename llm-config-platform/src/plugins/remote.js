import { normalizeBoolean, normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "api_url", label: "API URL", type: "text", required: true, format: "url", default: "https://api.example.com/v1/chat/completions" },
	{ key: "api_key", label: "API Key", type: "password", required: true, default: "" },
	{ key: "model", label: "Model", type: "text", required: true, default: "gpt-4o-mini" },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", label: "Max Tokens", type: "number", min: 1, default: 1024 },
	{ key: "top_p", label: "Top P", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "stream", label: "Stream", type: "boolean", default: true },
];

export const remotePlugin = {
	id: "remote",
	label: "Remote API",
	description: "Use any OpenAI-compatible chat completions endpoint.",
	fields,
	capabilities: {
		tools: true,
		json_mode: true,
	},
	normalize(config) {
		const output = {};
		fields.forEach((field) => {
			output[field.key] = normalizeByField(field, config[field.key]);
		});
		output.stream = normalizeBoolean(config.stream, true);
		return output;
	},
	toRequest(config) {
		return {
			provider: "remote",
			endpoint: config.api_url,
			headers: {
				Authorization: `Bearer ${config.api_key}`,
				"Content-Type": "application/json",
			},
			body: {
				model: config.model,
				temperature: config.temperature,
				max_tokens: config.max_tokens,
				top_p: config.top_p,
				stream: config.stream,
			},
		};
	},
};

