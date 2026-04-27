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

export const providerCapabilities = Object.fromEntries(
	providerPlugins.map((plugin) => [plugin.id, plugin.supported_features || {}])
);
