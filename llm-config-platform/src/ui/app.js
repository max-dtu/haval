import { buildUnifiedRequest } from "../core/unifiedRequest.js";
import { registry } from "../core/registry.js";
import { providerPlugins } from "../providers/catalog.js";
import { clearNode, createElement } from "../utils/dom.js";
import { isPlainObject } from "../utils/normalize.js";

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

function getProviderExamples() {
	return [
		{
			provider: "webllm",
			config: {
				model: "Llama-3-8B-Instruct-q4f32_1",
				temperature: 0.7,
				max_tokens: 512,
				top_p: 0.9,
				stream: true,
			},
		},
		{
			provider: "ollama",
			config: {
				endpoint: "http://localhost:11434",
				model: "llama3",
				temperature: 0.7,
				num_predict: 512,
				top_p: 0.9,
				top_k: 40,
				stream: true,
			},
		},
		{
			provider: "remote",
			config: {
				api_url: "https://api.example.com/v1/chat/completions",
				api_key: "YOUR_API_KEY",
				model: "gpt-4o-mini",
				temperature: 0.7,
				max_tokens: 1024,
				top_p: 0.9,
				stream: true,
			},
		},
		{
			provider: "openai",
			config: {
				api_url: "https://api.openai.com/v1/chat/completions",
				api_key: "YOUR_OPENAI_API_KEY",
				model: "gpt-4o-mini",
				temperature: 0.7,
				max_tokens: 1024,
				top_p: 0.9,
				stream: true,
			},
		},
		{
			provider: "anthropic",
			config: {
				api_key: "YOUR_ANTHROPIC_API_KEY",
				model: "claude-3-5-sonnet-latest",
				max_tokens: 1024,
				temperature: 0.7,
			},
		},
		{
			provider: "huggingface",
			config: {
				endpoint: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct",
				api_key: "YOUR_HF_API_KEY",
				max_new_tokens: 512,
				temperature: 0.7,
			},
		},
		{
			provider: "vllm",
			config: {
				api_url: "http://localhost:8000/v1/chat/completions",
				model: "meta-llama/Meta-Llama-3-8B-Instruct",
				temperature: 0.7,
				max_tokens: 1024,
			},
		},
	];
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

	if (!isPlainObject(parsed)) {
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

	if (!isPlainObject(parsed.config)) {
		return {
			ok: false,
			errors: ["config is required and must be a plain object"],
		};
	}

	return buildUnifiedRequest(parsed.provider, parsed.config);
}

function formatResult(result) {
	return JSON.stringify(
		{
			ok: result.ok,
			provider: result.provider,
			user_entered_config: result.user_entered_config,
			normalized_config: result.normalized_config,
			supported_features: result.supported_features,
			what_will_be_sent: result.what_will_be_sent,
		},
		null,
		2
	);
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
		text: `Set provider and config in JSON. Known fields are normalized, extra provider-specific fields are preserved and passed through. Available providers: ${providers}`,
	});
	const guidance = createElement("div", { className: "model-picker__guidance" });
	const guidanceTitle = createElement("p", {
		className: "model-picker__guidance-title",
		text: "How to read the output",
	});
	const guidanceList = createElement("ul", { className: "model-picker__guidance-list" });
	[
		"`ok` tells you whether the input was accepted and the result could be built successfully.",
		"`user_entered_config` shows exactly what you entered.",
		"`normalized_config` shows defaults and type normalization applied by the platform.",
		"`supported_features` shows the platform's declared feature support for the selected provider.",
		"`what_will_be_sent` shows the final provider-specific payload that would be sent.",
		"Extra provider-specific fields are preserved so you can keep full control over advanced options.",
	].forEach((text) => {
		guidanceList.appendChild(
			createElement("li", {
				className: "model-picker__guidance-item",
				text,
			})
		);
	});
	guidance.append(guidanceTitle, guidanceList);
	const examplesTitle = createElement("p", {
		className: "model-picker__description",
		text: "Examples (copy one and edit values):",
	});
	const examples = createElement("pre", {
		className: "model-picker__preview",
		text: getProviderExamples().map((example) => JSON.stringify(example, null, 2)).join("\n\n\n\n\n\n\n\n"),
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

	fieldset.append(legend, helper, guidance, examplesTitle, examples, textarea, status, preview, submit);
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
		preview.textContent = formatResult(result);
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
