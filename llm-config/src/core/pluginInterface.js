export function assertPluginShape(plugin) {
	if (!plugin || typeof plugin !== "object") {
		throw new Error("Plugin must be an object");
	}

	const requiredKeys = ["id", "fields", "normalize", "toRequest"];
	requiredKeys.forEach((key) => {
		if (!(key in plugin)) {
			throw new Error(`Plugin is missing required key: ${key}`);
		}
	});

	if (typeof plugin.normalize !== "function") {
		throw new Error(`Plugin ${plugin.id} normalize must be a function`);
	}

	if (typeof plugin.toRequest !== "function") {
		throw new Error(`Plugin ${plugin.id} toRequest must be a function`);
	}

	if ("supported_features" in plugin && (!plugin.supported_features || typeof plugin.supported_features !== "object" || Array.isArray(plugin.supported_features))) {
		throw new Error(`Plugin ${plugin.id} supported_features must be an object`);
	}

	return plugin;
}
