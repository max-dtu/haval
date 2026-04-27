import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "endpoint", type: "text", required: true, format: "url", default: "http://localhost:11434" },
	{ key: "model", type: "text", required: true, default: "llama3" },
	{ key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "num_predict", type: "number", min: 1, default: 512 },
	{ key: "top_p", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "top_k", type: "number", min: 1, default: 40 },
	{ key: "stream", type: "boolean", default: true },
];

export const ollamaPlugin = {
	id: "ollama",
	supported_features: {
		stream: true,
		top_p: true,
		top_k: true,
		max_tokens: false,
		num_predict: true,
		temperature: true,
		presence_penalty: false,
		frequency_penalty: false,
		tools: false,
		json_mode: false,
	},
	fields,
	normalize(config) {
		return normalizeFields(fields, config);
	},
	toRequest(config) {
		const { extra } = splitConfig(fields, config);
		const baseEndpoint = config.endpoint.replace(/\/+$/, "");
		const {
			options: extraOptions = {},
			headers: extraHeaders = {},
			...bodyExtra
		} = extra;

		return {
			provider: "ollama",
			endpoint: `${baseEndpoint}/api/generate`,
			headers: {
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: {
				model: config.model,
				options: {
					temperature: config.temperature,
					top_p: config.top_p,
					top_k: config.top_k,
					...extraOptions,
				},
				stream: config.stream,
				num_predict: config.num_predict,
				...bodyExtra,
			},
		};
	},
};
