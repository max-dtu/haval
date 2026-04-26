import { createElement } from "../utils/dom.js";

function createInput(field, value) {
	const inputType = field.type === "boolean" ? "checkbox" : field.type;
	const input = createElement("input", {
		className: field.type === "boolean" ? "model-picker__checkbox" : "model-picker__input",
		attrs: {
			type: inputType,
			name: field.key,
			placeholder: field.placeholder,
			min: field.min,
			max: field.max,
			step: field.step,
		},
		dataset: {
			key: field.key,
			fieldType: field.type,
		},
	});

	if (field.type === "boolean") {
		input.checked = value ?? field.default ?? false;
	} else {
		input.value = value ?? field.default ?? "";
	}

	return input;
}

export function generateFields({ root, provider, values }) {
	provider.fields.forEach((field) => {
		const wrapper = createElement("label", {
			className: "model-picker__label",
		});

		const title = createElement("span", {
			className: "model-picker__label-title",
			text: field.label || field.key,
		});

		const input = createInput(field, values[field.key]);

		if (provider.capabilities?.[field.key] === false) {
			input.disabled = true;
			wrapper.classList.add("model-picker__label--disabled");
			wrapper.title = "Not supported by this provider";
		}

		wrapper.append(title, input);
		root.appendChild(wrapper);
	});
}

