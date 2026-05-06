export const rules = {
	required(value) {
		if (value === undefined || value === null) {
			return false;
		}

		if (typeof value === "string") {
			return value.trim().length > 0;
		}

		return true;
	},

	number(value) {
		return typeof value === "number" && Number.isFinite(value);
	},

	min(value, minValue) {
		return typeof value === "number" && value >= minValue;
	},

	max(value, maxValue) {
		return typeof value === "number" && value <= maxValue;
	},

	url(value) {
		if (typeof value !== "string" || value.trim() === "") {
			return false;
		}

		try {
			const parsed = new URL(value);
			return ["http:", "https:"].includes(parsed.protocol);
		} catch {
			return false;
		}
	},
};

