import { remotePlugin } from "./remote.js";

export const openaiPlugin = {
	...remotePlugin,
	id: "openai",
	label: "OpenAI",
	description: "First-party OpenAI endpoint defaults.",
	normalize(config) {
		return remotePlugin.normalize({
			api_url: config.api_url || "https://api.openai.com/v1/chat/completions",
			...config,
		});
	},
};

