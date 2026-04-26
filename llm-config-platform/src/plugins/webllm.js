import { normalizeBoolean, normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "model", label: "Model", type: "text", required: true, default: "Llama-3-8B-Instruct-q4f32_1" },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "max_tokens", label: "Max Tokens", type: "number", min: 1, default: 512 },
	{ key: "top_p", label: "Top P", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "stream", label: "Stream", type: "boolean", default: true },
];

export const webllmPlugin = {
	id: "webllm",
	label: "WebLLM",
	description: "Runs a model directly in the browser via WebGPU.",
	fields,
	capabilities: {
		presence_penalty: false,
		frequency_penalty: false,
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
			provider: "webllm",
			model: config.model,
			options: {
				temperature: config.temperature,
				max_tokens: config.max_tokens,
				top_p: config.top_p,
				stream: config.stream,
			},
		};
	},
};

