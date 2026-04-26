import { createElement } from "../utils/dom.js";

export function renderTabs({ root, providers, activeProvider, onSelect }) {
	const tabs = createElement("nav", {
		className: "model-picker__tabs",
		attrs: { "aria-label": "Provider selection" },
	});

	providers.forEach((provider) => {
		const input = createElement("input", {
			attrs: {
				type: "radio",
				name: "provider",
				value: provider.id,
			},
			className: "model-picker__radio",
		});

		input.checked = provider.id === activeProvider;
		input.addEventListener("change", () => {
			if (input.checked) {
				onSelect(provider.id);
			}
		});

		const label = createElement("label", {
			className: "model-picker__tab",
			text: provider.label,
		});

		label.prepend(input);
		tabs.appendChild(label);
	});

	root.appendChild(tabs);
}

