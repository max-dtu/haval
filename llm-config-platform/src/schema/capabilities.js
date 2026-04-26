import { anthropicPlugin } from "../plugins/anthropic.js";
import { huggingFacePlugin } from "../plugins/huggingface.js";
import { ollamaPlugin } from "../plugins/ollama.js";
import { openaiPlugin } from "../plugins/openai.js";
import { remotePlugin } from "../plugins/remote.js";
import { vllmPlugin } from "../plugins/vllm.js";
import { webllmPlugin } from "../plugins/webllm.js";

export const providerPlugins = [
	webllmPlugin,
	ollamaPlugin,
	remotePlugin,
	openaiPlugin,
	anthropicPlugin,
	huggingFacePlugin,
	vllmPlugin,
];

export const providerCapabilities = providerPlugins.reduce((acc, plugin) => {
	acc[plugin.id] = plugin.capabilities || {};
	return acc;
}, {});

