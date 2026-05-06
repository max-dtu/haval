import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "api_url", type: "text", required: true, format: "url", default: "http://localhost:8000/v1/chat/completions" },
	{ key: "model", type: "text", required: true, default: "meta-llama/Meta-Llama-3-8B-Instruct" },
	{ key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", type: "number", min: 1, default: 1024 },
];

export const vllmPlugin = {
	id: "vllm",
	supported_features: {
		stream: true,
		top_p: true,
		max_tokens: true,
		temperature: true,
		presence_penalty: true,
		frequency_penalty: false,
		tools: true,
		json_mode: true,
	},
	fields,
	normalize(config) {
		return normalizeFields(fields, config);
	},
	toRequest(config) {
		const { extra } = splitConfig(fields, config);
		const {
			headers: extraHeaders = {},
			body: extraBody = {},
			...bodyExtra
		} = extra;

		return {
			provider: "vllm",
			endpoint: config.api_url,
			headers: {
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: {
				model: config.model,
				temperature: config.temperature,
				max_tokens: config.max_tokens,
				...bodyExtra,
				...extraBody,
			},
		};
	},
};
