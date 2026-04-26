import { providerPlugins } from "../schema/capabilities.js";

const firstProvider = providerPlugins[0]?.id || "";

export function createState(initial = {}) {
	let state = {
		provider: initial.provider || firstProvider,
		values: initial.values || {},
		result: initial.result || null,
		errors: initial.errors || [],
	};

	const listeners = new Set();

	function getState() {
		return state;
	}

	function setState(patch) {
		state = {
			...state,
			...patch,
		};

		listeners.forEach((listener) => listener(state));
	}

	function subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return {
		getState,
		setState,
		subscribe,
	};
}

