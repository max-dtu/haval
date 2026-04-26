import { buildUnifiedRequest } from "../core/unifiedRequest.js";
import { registry } from "../core/registry.js";
import { providerPlugins } from "../schema/capabilities.js";
import { clearNode, createElement } from "../utils/dom.js";

registry.registerMany(providerPlugins);

function getInitialPayload() {
	return {
		provider: "webllm",
		config: {
			model: "Llama-3-8B-Instruct-q4f32_1",
			temperature: 0.7,
			max_tokens: 512,
			top_p: 0.9,
			stream: true,
		},
	};
}

function validatePayload(rawText) {
	let parsed;

	try {
		parsed = JSON.parse(rawText);
	} catch (error) {
		return {
			ok: false,
			errors: [`Invalid JSON: ${error.message}`],
		};
	}

	if (!parsed || typeof parsed !== "object") {
		return {
			ok: false,
			errors: ["Input must be a JSON object"],
		};
	}

	if (!parsed.provider || typeof parsed.provider !== "string") {
		return {
			ok: false,
			errors: ["provider is required and must be a string"],
		};
	}

	if (!parsed.config || typeof parsed.config !== "object") {
		return {
			ok: false,
			errors: ["config is required and must be an object"],
		};
	}

	return buildUnifiedRequest(parsed.provider, parsed.config);
}

export function mountModelPicker(target) {
	const container = typeof target === "string" ? document.querySelector(target) : target;
	if (!container) {
		throw new Error("mountModelPicker target not found");
	}

	const providers = registry.list().map((plugin) => plugin.id).join(", ");

	const form = createElement("form", { className: "model-picker model-picker--json" });
	const fieldset = createElement("fieldset", { className: "model-picker__fieldset" });
	const legend = createElement("legend", {
		className: "model-picker__legend",
		text: "JSON Config Input",
	});
	const helper = createElement("p", {
		className: "model-picker__description",
		text: `Set provider and config in JSON. Available providers: ${providers}`,
	});
	const textarea = createElement("textarea", {
		className: "model-picker__textarea",
		attrs: {
			rows: 16,
			spellcheck: "false",
			"aria-label": "Model JSON config",
		},
	});
	const status = createElement("div", {
		className: "model-picker__status",
		attrs: {
			role: "status",
			"aria-live": "polite",
		},
	});
	const preview = createElement("pre", { className: "model-picker__preview" });
	const submit = createElement("button", { attrs: { type: "submit" }, text: "Validate & Build" });

	textarea.value = JSON.stringify(getInitialPayload(), null, 2);

	fieldset.append(legend, helper, textarea, status, preview, submit);
	form.append(fieldset);
	clearNode(container);
	container.appendChild(form);

	function updateFeedback(isStrictSubmit = false) {
		const result = validatePayload(textarea.value);

		if (!result.ok) {
			status.textContent = `Invalid input: ${result.errors.join("; ")}`;
			status.classList.add("model-picker__status--error");
			preview.textContent = "";
			return;
		}

		status.textContent = isStrictSubmit
			? "Valid input. Unified request built successfully."
			: "JSON is valid.";
		status.classList.remove("model-picker__status--error");
		preview.textContent = JSON.stringify(result, null, 2);
	}

	textarea.addEventListener("input", () => updateFeedback(false));

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		updateFeedback(true);
	});

	updateFeedback(false);
}

if (document.querySelector("#model-picker-root")) {
	mountModelPicker("#model-picker-root");
}

