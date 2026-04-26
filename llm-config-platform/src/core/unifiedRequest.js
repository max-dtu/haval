import { registry } from "./registry.js";
import { validateConfig } from "../validation/validator.js";

export function buildUnifiedRequest(providerId, rawConfig) {
	const plugin = registry.get(providerId);

	if (!plugin) {
		return {
			ok: false,
			errors: [`Unknown provider: ${providerId}`],
		};
	}

	const normalizedConfig = plugin.normalize(rawConfig || {});
	const validation = validateConfig({ fields: plugin.fields }, normalizedConfig);

	if (!validation.ok) {
		return {
			ok: false,
			errors: validation.errors,
			provider: providerId,
			config: normalizedConfig,
		};
	}

	return {
		ok: true,
		provider: providerId,
		config: normalizedConfig,
		request: plugin.toRequest(normalizedConfig),
		capabilities: plugin.capabilities || {},
	};
}

