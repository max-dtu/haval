import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "api_url", type: "text", required: true, format: "url", default: "https://api.example.com/v1/chat/completions" },
	{ key: "api_key", type: "password", required: true, default: "" },
	{ key: "model", type: "text", required: true, default: "gpt-4o-mini" },
	{ key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", type: "number", min: 1, default: 1024 },
	{ key: "top_p", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "stream", type: "boolean", default: true },
];

export const remotePlugin = {
	id: "remote",
	supported_features: {
		stream: true,
		top_p: true,
		max_tokens: true,
		temperature: true,
		presence_penalty: true,
		frequency_penalty: true,
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
			provider: "remote",
			endpoint: config.api_url,
			headers: {
				Authorization: `Bearer ${config.api_key}`,
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: {
				model: config.model,
				temperature: config.temperature,
				max_tokens: config.max_tokens,
				top_p: config.top_p,
				stream: config.stream,
				...bodyExtra,
				...extraBody,
			},
		};
	},
};
