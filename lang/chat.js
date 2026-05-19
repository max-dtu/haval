import { CreateMLCEngine } from "@mlc-ai/web-llm";

const DEFAULT_MODEL = "Llama-3-8B-Instruct-q4f32_1";

const state = {
  engine: null,
  isModelLoading: false,
  modelLoadProgress: 0,
  isGenerating: false,
  messages: [],
};

const els = {
  modelSelect: document.querySelector('[data-action="model-select"]'),
  loadBtn: document.querySelector('[data-action="load-model"]'),
  status: document.querySelector('[data-role="status"]'),
  progress: document.querySelector('[data-role="progress"]'),
  progressFill: document.querySelector('[data-role="progress-fill"]'),
  progressText: document.querySelector('[data-role="progress-text"]'),
  error: document.querySelector('[data-role="error"]'),
  loadingScreen: document.querySelector('[data-role="loading-screen"]'),
  chat: document.querySelector('[data-role="chat"]'),
  messages: document.querySelector('[data-role="messages"]'),
  form: document.querySelector('[data-action="send-message"]'),
  input: document.querySelector('[data-action="input"]'),
};

init();

function init() {
  els.loadBtn?.addEventListener("click", handleLoadModel);
  els.form?.addEventListener("submit", handleSendMessage);
  els.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      els.form?.dispatchEvent(new Event("submit"));
    }
  });
  els.input?.addEventListener("input", (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  });
  render();
}

async function handleLoadModel() {
  const modelId = els.modelSelect?.value || DEFAULT_MODEL;
  await loadModel(modelId);
}

async function loadModel(modelId) {
  if (state.isModelLoading || state.engine) return;

  state.isModelLoading = true;
  render();

  try {
    state.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        state.modelLoadProgress = Math.round(report.progress * 100);
        render();
      },
    });
    state.messages = [];
    state.isModelLoading = false;
    render();
  } catch (error) {
    state.isModelLoading = false;
    state.engine = null;
    showError(`Failed to load model: ${error.message}`);
    render();
  }
}

async function handleSendMessage(event) {
  event.preventDefault();
  if (state.isGenerating || !state.engine) return;

  const content = els.input?.value?.trim();
  if (!content) return;

  state.messages.push({ role: "user", content });
  els.input.value = "";
  els.input.style.height = "auto";
  state.isGenerating = true;
  render();

  try {
    const response = await state.engine.chat.completions.create({
      messages: state.messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    });

    let fullContent = "";
    const assistantMsg = { role: "assistant", content: "" };
    state.messages.push(assistantMsg);

    for await (const chunk of response) {
      const text = chunk.choices[0]?.delta?.content || "";
      fullContent += text;
      assistantMsg.content = fullContent;
      renderMessages();
      scrollToBottom();
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
    if (state.messages.length > 0) {
      state.messages.pop();
    }
  } finally {
    state.isGenerating = false;
    render();
  }
}

function render() {
  const hasEngine = !!state.engine;

  els.loadingScreen.style.display = hasEngine ? "none" : "block";
  els.chat.style.display = hasEngine ? "flex" : "none";

  els.loadBtn.disabled = state.isModelLoading;

  if (state.isModelLoading) {
    els.status.textContent = `Loading… ${state.modelLoadProgress}%`;
    els.progress.style.display = "block";
    els.progressFill.style.width = `${state.modelLoadProgress}%`;
    els.progressText.textContent = `${state.modelLoadProgress}%`;
  } else if (hasEngine) {
    els.status.textContent = `Model loaded`;
    els.progress.style.display = "none";
  } else {
    els.status.textContent = "Ready";
    els.progress.style.display = "none";
  }

  if (els.input) els.input.disabled = state.isGenerating;
  const submitBtn = els.form?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = state.isGenerating;

  renderMessages();
}

function renderMessages() {
  if (!els.messages) return;

  els.messages.innerHTML = "";

  if (!state.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Send a message to start.";
    els.messages.appendChild(empty);
    return;
  }

  state.messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = msg.content;

    div.appendChild(bubble);
    els.messages.appendChild(div);
  });

  scrollToBottom();
}

function scrollToBottom() {
  if (els.messages) {
    els.messages.scrollTop = els.messages.scrollHeight;
  }
}

function showError(msg) {
  if (els.error) {
    els.error.textContent = msg;
    els.error.classList.add("show");
    setTimeout(() => els.error.classList.remove("show"), 5000);
  }
}
