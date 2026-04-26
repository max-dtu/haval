export function createElement(tag, options = {}) {
	const {
		className,
		text,
		attrs = {},
		dataset = {},
		children = [],
	} = options;

	const element = document.createElement(tag);

	if (className) {
		element.className = className;
	}

	if (text !== undefined) {
		element.textContent = text;
	}

	Object.entries(attrs).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			element.setAttribute(key, String(value));
		}
	});

	Object.entries(dataset).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			element.dataset[key] = String(value);
		}
	});

	children.forEach((child) => {
		if (child) {
			element.appendChild(child);
		}
	});

	return element;
}

export function clearNode(node) {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
}

