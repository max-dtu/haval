import { createElement, clearNode } from "../utils/dom.js";
import { generateFields } from "./formGenerator.js";

export function renderPanel({ root, provider, values }) {
	clearNode(root);

	const heading = createElement("h2", {
		className: "model-picker__heading",
		text: provider.label,
	});

	const description = createElement("p", {
		className: "model-picker__description",
		text: provider.description,
	});

	root.append(heading, description);
	generateFields({ root, provider, values });
}

