import { normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "api_url", label: "API URL", type: "text", required: true, format: "url", default: "http://localhost:8000/v1/chat/completions" },
	{ key: "model", label: "Model", type: "text", required: true, default: "meta-llama/Meta-Llama-3-8B-Instruct" },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", label: "Max Tokens", type: "number", min: 1, default: 1024 },
];

export const vllmPlugin = {
	id: "vllm",
	label: "vLLM",
	description: "OpenAI-compatible vLLM server mapper.",
	fields,
	capabilities: {
		frequency_penalty: false,
	},
	normalize(config) {
		const output = {};
		fields.forEach((field) => {
			output[field.key] = normalizeByField(field, config[field.key]);
		});
		return output;
	},
	toRequest(config) {
		return {
			provider: "vllm",
			endpoint: config.api_url,
			headers: {
				"Content-Type": "application/json",
			},
			body: {
				model: config.model,
				temperature: config.temperature,
				max_tokens: config.max_tokens,
			},
		};
	},
};

