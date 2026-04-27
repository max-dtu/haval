import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "api_key", type: "password", required: true, default: "" },
	{ key: "model", type: "text", required: true, default: "claude-3-5-sonnet-latest" },
	{ key: "max_tokens", type: "number", min: 1, default: 1024 },
	{ key: "temperature", type: "number", min: 0, max: 1, default: 0.7 },
];

export const anthropicPlugin = {
	id: "anthropic",
	supported_features: {
		stream: false,
		top_p: false,
		max_tokens: true,
		temperature: true,
		presence_penalty: false,
		frequency_penalty: false,
		tools: true,
		json_mode: false,
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
			provider: "anthropic",
			endpoint: "https://api.anthropic.com/v1/messages",
			headers: {
				"x-api-key": config.api_key,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
				...extraHeaders,
			},
			body: {
				model: config.model,
				max_tokens: config.max_tokens,
				temperature: config.temperature,
				...bodyExtra,
				...extraBody,
			},
		};
	},
};
