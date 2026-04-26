import { diffObjects } from "../diff/diffEngine.js";
import { deepClone } from "../utils/deepClone.js";
import { buildUnifiedRequest } from "./unifiedRequest.js";

export function createRunner() {
	let previousConfig = null;

	function run(providerId, config) {
		const unified = buildUnifiedRequest(providerId, config);

		if (!unified.ok) {
			return unified;
		}

		const changes = diffObjects(previousConfig || {}, unified.config);
		previousConfig = deepClone(unified.config);

		return {
			...unified,
			changes,
		};
	}

	function reset() {
		previousConfig = null;
	}

	return {
		run,
		reset,
	};
}

