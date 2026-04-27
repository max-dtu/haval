import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "model", type: "text", required: true, default: "Llama-3-8B-Instruct-q4f32_1" },
	{ key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", type: "number", min: 1, default: 512 },
	{ key: "top_p", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "stream", type: "boolean", default: true },
];

export const webllmPlugin = {
	id: "webllm",
	supported_features: {
		stream: true,
		top_p: true,
		max_tokens: true,
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

		return {
			provider: "webllm",
			model: config.model,
			options: {
				temperature: config.temperature,
				max_tokens: config.max_tokens,
				top_p: config.top_p,
				stream: config.stream,
				...extra,
			},
		};
	},
};
