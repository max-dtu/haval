import { registry } from "./registry.js";
import { validateConfig } from "../validation/validator.js";
import { describeNormalization, isPlainObject } from "../utils/normalize.js";
import { deepClone } from "../utils/deepClone.js";

export function buildUnifiedRequest(providerId, rawConfig) {
	const plugin = registry.get(providerId);

	if (!plugin) {
		return {
			ok: false,
			errors: [`Unknown provider: ${providerId}`],
		};
	}

	if (!isPlainObject(rawConfig)) {
		return {
			ok: false,
			errors: ["config must be a plain object"],
			provider: providerId,
		};
	}

	const normalizedConfig = plugin.normalize(rawConfig);
	const transformations = describeNormalization(plugin.fields, rawConfig, normalizedConfig);
	const validation = validateConfig({ fields: plugin.fields }, normalizedConfig);

	if (!validation.ok) {
		return {
			ok: false,
			errors: validation.errors,
			provider: providerId,
			raw_config: deepClone(rawConfig),
			normalized_config: normalizedConfig,
			transformations,
		};
	}

	return {
		ok: true,
		provider: providerId,
		raw_config: deepClone(rawConfig),
		normalized_config: normalizedConfig,
		supported_features: deepClone(plugin.supported_features || {}),
		provider_request: plugin.toRequest(normalizedConfig),
		transformations,
	};
}
