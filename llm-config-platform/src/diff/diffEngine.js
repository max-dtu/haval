function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function diffObjects(previous = {}, next = {}, basePath = "") {
	const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
	const changes = [];

	keys.forEach((key) => {
		const oldValue = previous[key];
		const newValue = next[key];
		const path = basePath ? `${basePath}.${key}` : key;

		if (isPlainObject(oldValue) && isPlainObject(newValue)) {
			changes.push(...diffObjects(oldValue, newValue, path));
			return;
		}

		if (Array.isArray(oldValue) && Array.isArray(newValue)) {
			if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
				changes.push({ path, from: oldValue, to: newValue });
			}
			return;
		}

		if (oldValue !== newValue) {
			changes.push({ path, from: oldValue, to: newValue });
		}
	});

	return changes;
}

