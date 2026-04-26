// schema → generate UI → apply defaults → apply capability rules → validate → extract → live preview + submit

const SCHEMA = {
  webllm: {
    label: "WebLLM (Browser)",
    description: "Runs fully in browser using WebGPU.",
    capabilities: {
      repeat_penalty: false,
      presence_penalty: false,
    },
    fields: [
      { key: "model", type: "text", placeholder: "llama3", default: "llama3" },
      { key: "temperature", type: "number", min: 0, max: 2, default: 0.7 },
      { key: "max_tokens", type: "number", default: 512 },
      {
        key: "top_p",
        type: "number",
        step: 0.05,
        min: 0,
        max: 1,
        default: 0.9,
      },
      { key: "top_k", type: "number", default: 40 },
      { key: "seed", type: "number", default: null },
      { key: "context_window", type: "number", default: 4096 },
    ],
  },

  ollama: {
    label: "Ollama (Local)",
    description: "Connects to local Ollama server.",
    capabilities: {},
    fields: [
      { key: "endpoint", type: "text", default: "http://localhost:11434" },
      { key: "model", type: "text", default: "llama3" },
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
    label: "Remote API",
    description: "External LLM API (OpenAI-compatible).",
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

function createField(field) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";

  const label = document.createElement("div");
  label.textContent = field.key;

  const input = document.createElement("input");

  input.dataset.key = field.key;
  input.type = field.type === "boolean" ? "checkbox" : field.type;

  if (field.type === "boolean") {
    input.checked = field.default ?? false;
  } else {
    input.value = field.default ?? "";
  }

  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.min !== undefined) input.min = field.min;
  if (field.max !== undefined) input.max = field.max;
  if (field.step !== undefined) input.step = field.step;

  const hint = document.createElement("small");
  hint.textContent = `type: ${field.type}`;

  wrapper.append(label, input, hint);
  return wrapper;
}

function renderPanel(providerKey) {
  const panel = document.querySelector("#panel");
  const schema = SCHEMA[providerKey];

  panel.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = schema.label;

  const desc = document.createElement("p");
  desc.textContent = schema.description;

  panel.append(title, desc);

  schema.fields.forEach((f) => {
    const el = createField(f);

    // capability system (gray out unsupported)
    if (schema.capabilities[f.key] === false) {
      el.querySelector("input").disabled = true;
      el.style.opacity = 0.4;
      el.title = "Not supported by this provider";
    }

    panel.appendChild(el);
  });
}

function getProvider() {
  return document.querySelector("input[name='provider']:checked").value;
}

function extract(provider) {
  const panel = document.querySelector("#panel");

  const data = {};

  panel.querySelectorAll("[data-key]").forEach((input) => {
    const key = input.dataset.key;

    if (input.type === "checkbox") {
      data[key] = input.checked;
    } else if (input.type === "number") {
      data[key] = input.value === "" ? null : Number(input.value);
    } else {
      data[key] = input.value;
    }
  });

  return data;
}

function updatePreview(obj) {
  document.querySelector("#preview").textContent = JSON.stringify(obj, null, 2);
}

// App Bootstrap
const form = document.querySelector(".model-picker");

let activeProvider = getProvider();

renderPanel(activeProvider);

document.querySelectorAll("input[name='provider']").forEach((radio) => {
  radio.addEventListener("change", () => {
    activeProvider = getProvider();
    renderPanel(activeProvider);
  });
});

// live preview
form.addEventListener("input", () => {
  const data = extract(activeProvider);
  updatePreview({ provider: activeProvider, ...data });
});

// submit
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = extract(activeProvider);

  console.log("FINAL CONFIG:", {
    provider: activeProvider,
    ...data,
  });
});
