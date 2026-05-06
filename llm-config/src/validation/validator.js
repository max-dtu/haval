import { rules } from "./rules.js";

export function validateConfig(schema, config) {
	const errors = [];

	schema.fields.forEach((field) => {
		const value = config[field.key];

		if (field.required && !rules.required(value)) {
			errors.push(`${field.key} is required`);
			return;
		}

		if (value === undefined || value === null || value === "") {
			return;
		}

		if (field.type === "number" && !rules.number(value)) {
			errors.push(`${field.key} must be a valid number`);
			return;
		}

		if (field.min !== undefined && !rules.min(value, field.min)) {
			errors.push(`${field.key} must be >= ${field.min}`);
		}

		if (field.max !== undefined && !rules.max(value, field.max)) {
			errors.push(`${field.key} must be <= ${field.max}`);
		}

		if (field.format === "url" && !rules.url(value)) {
			errors.push(`${field.key} must be a valid http/https URL`);
		}
	});

	return {
		ok: errors.length === 0,
		errors,
	};
}

