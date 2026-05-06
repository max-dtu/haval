import { remotePlugin } from "./remote.js";

export const openaiPlugin = {
	...remotePlugin,
	id: "openai",
	normalize(config) {
		return remotePlugin.normalize({
			api_url: config.api_url || "https://api.openai.com/v1/chat/completions",
			...config,
		});
	},
	toRequest(config) {
		const request = remotePlugin.toRequest(config);

		return {
			...request,
			provider: "openai",
		};
	},
};
