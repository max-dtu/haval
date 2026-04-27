import { deepClone } from "./deepClone.js";

export function normalizeString(value, fallback = "") {
	if (value === undefined || value === null) {
		return fallback;
	}

	return String(value).trim();
}

export function normalizeNumber(value, fallback = null) {
	if (value === "" || value === undefined || value === null) {
		return fallback;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBoolean(value, fallback = false) {
	if (typeof value === "boolean") {
		return value;
	}

	if (value === "true" || value === "1" || value === 1) {
		return true;
	}

	if (value === "false" || value === "0" || value === 0) {
		return false;
	}

	return fallback;
}

export function normalizeByField(field, value) {
	switch (field.type) {
		case "number":
			return normalizeNumber(value, field.default ?? null);
		case "boolean":
			return normalizeBoolean(value, field.default ?? false);
		default:
			return normalizeString(value, field.default ?? "");
	}
}

export function normalizeFields(fields, config = {}) {
	const output = {};
	const knownKeys = new Set(fields.map((field) => field.key));

	fields.forEach((field) => {
		output[field.key] = normalizeByField(field, config[field.key]);
	});

	Object.keys(config).forEach((key) => {
		if (!knownKeys.has(key)) {
			output[key] = deepClone(config[key]);
		}
	});

	return output;
}

export function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function splitConfig(fields, config = {}) {
	const knownKeys = new Set(fields.map((field) => field.key));
	const known = {};
	const extra = {};

	Object.keys(config).forEach((key) => {
		if (knownKeys.has(key)) {
			known[key] = config[key];
			return;
		}

		extra[key] = config[key];
	});

	return { known, extra };
}
