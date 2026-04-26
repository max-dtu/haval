import { clearNode, createElement } from "../utils/dom.js";

export function renderPreview({ root, result, errors }) {
	clearNode(root);

	if (errors?.length) {
		const list = createElement("ul", { className: "model-picker__errors" });
		errors.forEach((error) => {
			list.appendChild(createElement("li", { text: error }));
		});
		root.appendChild(list);
		return;
	}

	const pre = createElement("pre", {
		className: "model-picker__preview",
		text: JSON.stringify(result, null, 2),
	});
	root.appendChild(pre);
}

