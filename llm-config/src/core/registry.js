import { assertPluginShape } from "./pluginInterface.js";

export function createRegistry() {
	const plugins = new Map();

	function register(plugin) {
		const validPlugin = assertPluginShape(plugin);
		plugins.set(validPlugin.id, validPlugin);
		return validPlugin;
	}

	function registerMany(pluginList) {
		pluginList.forEach((plugin) => register(plugin));
	}

	function get(id) {
		return plugins.get(id) || null;
	}

	function list() {
		return Array.from(plugins.values());
	}

	return {
		register,
		registerMany,
		get,
		list,
	};
}

export const registry = createRegistry();

