import { normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "api_key", label: "API Key", type: "password", required: true, default: "" },
	{ key: "model", label: "Model", type: "text", required: true, default: "claude-3-5-sonnet-latest" },
	{ key: "max_tokens", label: "Max Tokens", type: "number", min: 1, default: 1024 },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 1, default: 0.7 },
];

export const anthropicPlugin = {
	id: "anthropic",
	label: "Anthropic",
	description: "Anthropic Messages API request mapping.",
	fields,
	capabilities: {
		top_p: false,
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
			provider: "anthropic",
			endpoint: "https://api.anthropic.com/v1/messages",
			headers: {
				"x-api-key": config.api_key,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			},
			body: {
				model: config.model,
				max_tokens: config.max_tokens,
				temperature: config.temperature,
			},
		};
	},
};

