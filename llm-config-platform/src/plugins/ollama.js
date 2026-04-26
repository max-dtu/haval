import { normalizeBoolean, normalizeByField } from "../utils/normalize.js";

const fields = [
	{ key: "endpoint", label: "Endpoint", type: "text", required: true, format: "url", default: "http://localhost:11434" },
	{ key: "model", label: "Model", type: "text", required: true, default: "llama3" },
	{ key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, default: 0.7 },
	{ key: "num_predict", label: "Num Predict", type: "number", min: 1, default: 512 },
	{ key: "top_p", label: "Top P", type: "number", min: 0, max: 1, default: 0.9 },
	{ key: "top_k", label: "Top K", type: "number", min: 1, default: 40 },
	{ key: "stream", label: "Stream", type: "boolean", default: true },
];

export const ollamaPlugin = {
	id: "ollama",
	label: "Ollama",
	description: "Connect to local or remote Ollama servers.",
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
			provider: "ollama",
			endpoint: `${config.endpoint}/api/generate`,
			body: {
				model: config.model,
				options: {
					temperature: config.temperature,
					top_p: config.top_p,
					top_k: config.top_k,
				},
				stream: config.stream,
				num_predict: config.num_predict,
			},
		};
	},
};

