// schema → generate UI → apply defaults → apply capability rules → validate → extract → preview

const PROVIDERS = {
  webllm: {
    capabilities: {
      top_k: true,
      repeat_penalty: false,
      presence_penalty: false,
    },
    fields: [
      { key: "model", type: "text", default: "llama3" },
      { key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
      { key: "max_tokens", type: "number", default: 512 },
      { key: "top_p", type: "number", default: 0.9 },
      { key: "top_k", type: "number", default: 40 },
      { key: "seed", type: "number" },
      { key: "context_window", type: "number", default: 4096 },
    ],
  },

  ollama: {
    capabilities: {
      presence_penalty: false,
    },
    fields: [
      { key: "endpoint", type: "text", default: "http://localhost:11434" },
      { key: "model", type: "text" },
      { key: "temperature", type: "number", default: 0.7 },
      { key: "num_predict", type: "number", default: 512 },
      { key: "top_k", type: "number", default: 40 },
      { key: "top_p", type: "number", default: 0.9 },
      { key: "repeat_penalty", type: "number", default: 1.1 },
      { key: "seed", type: "number" },
      { key: "context_length", type: "number", default: 4096 },
      { key: "stream", type: "boolean", default: true },
    ],
  },

  remote: {
    capabilities: {},
    fields: [
      { key: "api_url", type: "text" },
      { key: "api_key", type: "password" },
      { key: "model", type: "text" },
      { key: "temperature", type: "number", default: 0.7 },
      { key: "max_tokens", type: "number", default: 1024 },
      { key: "top_p", type: "number", default: 0.9 },
      { key: "presence_penalty", type: "number", default: 0 },
      { key: "frequency_penalty", type: "number", default: 0 },
      { key: "seed", type: "number" },
      { key: "stream", type: "boolean", default: true },
    ],
  },
};

function generateForm(providerKey, container) {
  const provider = PROVIDERS[providerKey];

  container.innerHTML = "";

  provider.fields.forEach((field) => {
    const wrapper = document.createElement("label");
    wrapper.className = "model-picker__label";

    const input = document.createElement("input");
    input.name = field.key;
    input.dataset.key = field.key;

    input.className = "model-picker__input";
    input.type = field.type === "boolean" ? "checkbox" : field.type;

    if (field.default !== undefined && field.type !== "boolean") {
      input.value = field.default;
    }

    if (field.type === "boolean") {
      input.checked = !!field.default;
    }

    const labelText = document.createTextNode(" " + field.key);

    const hint = document.createElement("small");
    hint.textContent = `type: ${field.type}`;

    wrapper.appendChild(document.createTextNode(field.key));
    wrapper.appendChild(input);
    wrapper.appendChild(hint);

    container.appendChild(wrapper);
  });
}

// CAPABILITY SYSTEM (gray-out unsupported fields)
function applyCapabilities(providerKey, container) {
  const caps = PROVIDERS[providerKey].capabilities;

  container.querySelectorAll("[data-key]").forEach((input) => {
    const key = input.dataset.key;

    const supported = caps[key] !== false;

    if (!supported) {
      input.disabled = true;
      input.style.opacity = 0.4;
      input.title = "Not supported by this provider";
    } else {
      input.disabled = false;
      input.style.opacity = 1;
      input.title = "";
    }
  });
}

function validate(providerKey, data) {
  const schema = PROVIDERS[providerKey].fields;

  const errors = [];

  schema.forEach((field) => {
    const value = data[field.key];

    if (field.type === "number") {
      if (value !== undefined && isNaN(Number(value))) {
        errors.push(`${field.key} must be a number`);
      }

      if (field.min !== undefined && value < field.min) {
        errors.push(`${field.key} must be >= ${field.min}`);
      }

      if (field.max !== undefined && value > field.max) {
        errors.push(`${field.key} must be <= ${field.max}`);
      }
    }

    if (!field.optional && (value === "" || value == null)) {
      errors.push(`${field.key} is required`);
    }
  });

  return errors;
}

// <pre id="json-preview"></pre>
function updatePreview(data) {
  const box = document.querySelector("#json-preview");
  box.textContent = JSON.stringify(data, null, 2);
}

const form = document.querySelector(".model-picker");

function getProvider() {
  return document.querySelector('input[name="model"]:checked').id;
}

function extract(panel) {
  const data = {};
  panel.querySelectorAll("[name]").forEach((input) => {
    if (input.type === "checkbox") {
      data[input.name] = input.checked;
    } else {
      data[input.name] = input.value;
    }
  });
  return data;
}

form.addEventListener("input", () => {
  const provider = getProvider();
  const panel = document.querySelector(`[data-provider="${provider}"]`);

  const data = extract(panel);

  updatePreview({ provider, ...data });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const provider = getProvider();
  const panel = document.querySelector(`[data-provider="${provider}"]`);

  const data = extract(panel);

  const errors = validate(provider, data);

  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }

  console.log("FINAL CONFIG:", { provider, ...data });
});
