import { normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "endpoint", label: "Inference Endpoint", type: "text", required: true, format: "url", default: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct" },
	{ key: "api_key", label: "API Key", type: "password", required: true, default: "" },
	{ key: "max_new_tokens", label: "Max New Tokens", type: "number", min: 1, default: 512 },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, default: 0.7 },
];

export const huggingFacePlugin = {
	id: "huggingface",
	label: "Hugging Face",
	description: "Hugging Face Inference API config mapper.",
	fields,
	capabilities: {
		stream: false,
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
			provider: "huggingface",
			endpoint: config.endpoint,
			headers: {
				Authorization: `Bearer ${config.api_key}`,
				"Content-Type": "application/json",
			},
			body: {
				parameters: {
					max_new_tokens: config.max_new_tokens,
					temperature: config.temperature,
				},
			},
		};
	},
};

