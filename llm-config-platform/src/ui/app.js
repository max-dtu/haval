import { createRunner } from "../core/runner.js";
import { registry } from "../core/registry.js";
import { providerPlugins } from "../schema/capabilities.js";
import { clearNode, createElement } from "../utils/dom.js";
import { normalizeByField } from "../utils/normalize.js";
import { renderPanel } from "./renderPanel.js";
import { renderPreview } from "./preview.js";
import { renderTabs } from "./renderTabs.js";
import { createState } from "./state.js";

registry.registerMany(providerPlugins);

function extractFormValues(form) {
	const values = {};
	form.querySelectorAll("[data-key]").forEach((input) => {
		const key = input.dataset.key;
		const fieldType = input.dataset.fieldType;
		const pseudoField = {
			type: fieldType,
			default: fieldType === "boolean" ? false : "",
		};

		const rawValue = input.type === "checkbox" ? input.checked : input.value;
		values[key] = normalizeByField(pseudoField, rawValue);
	});
	return values;
}

export function mountModelPicker(target) {
	const container = typeof target === "string" ? document.querySelector(target) : target;
	if (!container) {
		throw new Error("mountModelPicker target not found");
	}

	const providers = registry.list();
	const runner = createRunner();
	const state = createState({ provider: providers[0]?.id });

	const form = createElement("form", { className: "model-picker" });
	const fieldset = createElement("fieldset", { className: "model-picker__fieldset" });
	const legend = createElement("legend", { className: "model-picker__legend", text: "Choose model source" });
	const panel = createElement("section", { attrs: { id: "panel" }, className: "model-picker__panel" });
	const previewRoot = createElement("section", { className: "model-picker__preview-root" });
	const submit = createElement("button", { attrs: { type: "submit" }, text: "Submit" });

	fieldset.append(legend);
	form.append(fieldset);
	clearNode(container);
	container.appendChild(form);

	function rerender() {
		const current = state.getState();
		const provider = registry.get(current.provider);

		clearNode(fieldset);
		fieldset.append(legend);

		renderTabs({
			root: fieldset,
			providers,
			activeProvider: current.provider,
			onSelect: (providerId) => {
				state.setState({ provider: providerId, values: {}, errors: [] });
			},
		});

		renderPanel({ root: panel, provider, values: current.values });
		fieldset.append(panel, previewRoot, submit);

		const result = runner.run(current.provider, current.values);
		state.setState({
			result: result.ok ? result : null,
			errors: result.ok ? [] : result.errors,
		});
	}

	state.subscribe((nextState) => {
		renderPreview({
			root: previewRoot,
			result: nextState.result || { provider: nextState.provider, ...nextState.values },
			errors: nextState.errors,
		});
	});

	form.addEventListener("input", () => {
		state.setState({ values: extractFormValues(form) });
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const current = state.getState();
		const result = runner.run(current.provider, current.values);
		state.setState({ result: result.ok ? result : null, errors: result.ok ? [] : result.errors });

		if (result.ok) {
			console.log("FINAL CONFIG", result);
		}
	});

	rerender();
	state.setState({ values: extractFormValues(form) });
}

if (document.querySelector("#model-picker-root")) {
	mountModelPicker("#model-picker-root");
}

