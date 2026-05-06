import { normalizeFields, splitConfig } from "../utils/normalize.js";

const fields = [
	{ key: "endpoint", type: "text", required: true, format: "url", default: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct" },
	{ key: "api_key", type: "password", required: true, default: "" },
	{ key: "max_new_tokens", type: "number", min: 1, default: 512 },
	{ key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
];

export const huggingFacePlugin = {
	id: "huggingface",
	supported_features: {
		stream: false,
		top_p: false,
		max_tokens: false,
		max_new_tokens: true,
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
		const {
			headers: extraHeaders = {},
			parameters: extraParameters = {},
			options: extraOptions = {},
			...parameterExtra
		} = extra;

		return {
			provider: "huggingface",
			endpoint: config.endpoint,
			headers: {
				Authorization: `Bearer ${config.api_key}`,
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: {
				parameters: {
					max_new_tokens: config.max_new_tokens,
					temperature: config.temperature,
					...parameterExtra,
					...extraParameters,
				},
				options: extraOptions,
			},
		};
	},
};
