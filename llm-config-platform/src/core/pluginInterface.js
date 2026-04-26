export function assertPluginShape(plugin) {
	if (!plugin || typeof plugin !== "object") {
		throw new Error("Plugin must be an object");
	}

	const requiredKeys = ["id", "label", "description", "fields", "normalize", "toRequest"];
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

	return plugin;
}

