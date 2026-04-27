
import { providerPlugins } from "../llm-config-platform/src/providers/catalog.js";

const STORAGE_KEY_THREADS = "haval.threads.v1";
const STORAGE_KEY_MODELS = "haval.model-presets.v1";
const UNTITLED_TITLE = "Untitled Thread";
const READY_MESSAGE = "Ready when you are.";

const state = {
  threads: [],
  activeThreadId: null,
  query: "",
};

const elements = {
  newThreadButton: document.querySelector('button[data-action="new-thread"]'),
  searchForm: document.querySelector('form[data-action="search-threads"]'),
  searchInput: document.querySelector('[data-role="thread-search-input"]'),
  threadList: document.querySelector('[data-role="thread-list"]'),
  threadListEmpty: document.querySelector('[data-role="thread-list-empty"]'),
  emptyState: document.querySelector('[data-role="empty-state"]'),
  threadStage: document.querySelector('[data-role="thread-stage"]'),
  threadTemplate: document.querySelector("#thread"),
};

const fallbackModels = buildModelOptionsFromPlugins(providerPlugins);
const persistedModels = readPersistedModelOptions();
const availableModels = dedupeModelOptions([...persistedModels, ...fallbackModels]);

initialize();

function initialize() {
  if (!hasRequiredElements()) {
    return;
  }

  hydrateState();
  bindEvents();

  if (!state.threads.length) {
    createThread();
    return;
  }

  if (!findThreadById(state.activeThreadId)) {
    state.activeThreadId = state.threads[0].id;
  }

  render();
}

function hasRequiredElements() {
  return Boolean(
    elements.newThreadButton &&
      elements.searchForm &&
      elements.searchInput &&
      elements.threadList &&
      elements.threadListEmpty &&
      elements.emptyState &&
      elements.threadStage &&
      elements.threadTemplate
  );
}

function bindEvents() {
  elements.newThreadButton.addEventListener("click", () => {
    createThread();
  });

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderThreadList();
  });

  elements.threadList.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="select-thread"]');
    if (!button) {
      return;
    }

    const { threadId } = button.dataset;
    if (!threadId || state.activeThreadId === threadId) {
      return;
    }

    state.activeThreadId = threadId;
    persistState();
    render();
  });

  elements.threadStage.addEventListener("click", handleThreadStageClick);
  elements.threadStage.addEventListener("change", handleThreadStageChange);
  elements.threadStage.addEventListener("submit", handleThreadStageSubmit);
}

function createThread() {
  const now = new Date().toISOString();
  const thread = {
    id: createId("thread"),
    title: UNTITLED_TITLE,
    createdAt: now,
    updatedAt: now,
    selectedModel: availableModels[0]?.value || "",
    minimized: false,
    messages: [buildMessage("assistant", READY_MESSAGE, now)],
  };

  state.threads.unshift(thread);
  state.activeThreadId = thread.id;
  persistState();
  render();
  focusComposer();
}

function handleThreadStageClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const activeThread = getActiveThread();
  if (!activeThread) {
    return;
  }

  if (button.dataset.action === "minimize-thread") {
    activeThread.minimized = !activeThread.minimized;
    persistState();
    renderActiveThread();
  }
}

function handleThreadStageChange(event) {
  const select = event.target.closest('select[data-action="select-model"]');
  if (!select) {
    return;
  }

  const activeThread = getActiveThread();
  if (!activeThread) {
    return;
  }

  activeThread.selectedModel = select.value;
  activeThread.updatedAt = new Date().toISOString();
  persistState();
  renderThreadList();
}

function handleThreadStageSubmit(event) {
  const form = event.target.closest('form[data-action="send-message"]');
  if (!form) {
    return;
  }

  event.preventDefault();

  const input = form.querySelector('[data-role="composer-input"]');
  if (!input) {
    return;
  }

  const messageText = input.value.trim();
  if (!messageText) {
    return;
  }

  const activeThread = getActiveThread();
  if (!activeThread) {
    return;
  }

  input.value = "";

  const now = new Date().toISOString();
  activeThread.messages.push(buildMessage("user", messageText, now));
  activeThread.updatedAt = now;
  activeThread.minimized = false;

  if (activeThread.title === UNTITLED_TITLE) {
    activeThread.title = buildThreadTitle(messageText);
  }

  moveThreadToTop(activeThread.id);
  persistState();
  render();
  focusComposer();
}

function render() {
  sortThreadsByRecency();
  renderThreadList();
  renderActiveThread();
}

function renderThreadList() {
  const filteredThreads = getFilteredThreads();
  elements.threadList.textContent = "";

  const fragment = document.createDocumentFragment();

  filteredThreads.forEach((thread) => {
    const item = document.createElement("li");
    item.className = "thread-list__item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "thread-list__button";
    button.dataset.action = "select-thread";
    button.dataset.threadId = thread.id;

    if (thread.id === state.activeThreadId) {
      button.classList.add("thread-list__button--active");
    }

    const titleRow = document.createElement("div");
    titleRow.className = "thread-list__title-row";

    const title = document.createElement("span");
    title.className = "thread-list__title";
    title.textContent = thread.title;

    const time = document.createElement("time");
    time.className = "thread-list__time";
    time.dateTime = thread.updatedAt;
    time.textContent = formatTimestamp(thread.updatedAt);

    titleRow.append(title, time);

    const snippet = document.createElement("span");
    snippet.className = "thread-list__snippet";
    snippet.textContent = getThreadSnippet(thread);

    button.append(titleRow, snippet);
    item.appendChild(button);
    fragment.appendChild(item);
  });

  elements.threadList.appendChild(fragment);

  const hasNoThreads = state.threads.length === 0;
  const hasNoMatches = !hasNoThreads && filteredThreads.length === 0;

  elements.threadListEmpty.hidden = !hasNoThreads && !hasNoMatches;

  if (hasNoThreads) {
    elements.threadListEmpty.textContent = "No threads yet. Click + to start.";
  } else if (hasNoMatches) {
    elements.threadListEmpty.textContent = "No threads match your search.";
  }
}

function renderActiveThread() {
  const activeThread = getActiveThread();
  elements.threadStage.textContent = "";

  if (!activeThread) {
    elements.emptyState.hidden = false;
    return;
  }

  elements.emptyState.hidden = true;

  const fragment = elements.threadTemplate.content.cloneNode(true);
  const panel = fragment.querySelector(".thread-panel");
  const title = fragment.querySelector('[data-role="thread-title"]');
  const timestamp = fragment.querySelector('[data-role="thread-timestamp"]');
  const modelSelect = fragment.querySelector('select[data-action="select-model"]');
  const modelField = fragment.querySelector(".thread-panel__model-field");
  const messageList = fragment.querySelector('[data-role="message-list"]');
  const composerForm = fragment.querySelector('form[data-action="send-message"]');
  const minimizeButton = fragment.querySelector('button[data-action="minimize-thread"]');

  if (!panel || !title || !timestamp || !modelSelect || !modelField || !messageList || !composerForm || !minimizeButton) {
    return;
  }

  title.textContent = activeThread.title;

  const firstMessage = activeThread.messages[0];
  const startedAt = firstMessage?.createdAt || activeThread.createdAt;

  timestamp.dateTime = startedAt;
  timestamp.textContent = `Started ${formatTimestamp(startedAt)}`;

  const selectedModel = getValidSelectedModel(activeThread.selectedModel);
  activeThread.selectedModel = selectedModel;
  populateModelSelect(modelSelect, selectedModel);
  modelField.hidden = availableModels.length === 0;

  renderMessages(messageList, activeThread.messages);

  if (activeThread.minimized) {
    panel.dataset.state = "collapsed";
    minimizeButton.textContent = "+";
    minimizeButton.setAttribute("aria-label", "Expand chat");
    messageList.hidden = true;
    composerForm.hidden = true;
  } else {
    panel.dataset.state = "expanded";
    minimizeButton.textContent = "-";
    minimizeButton.setAttribute("aria-label", "Minimize chat");
    messageList.hidden = false;
    composerForm.hidden = false;
  }

  elements.threadStage.appendChild(fragment);
  persistState();
}

function renderMessages(listNode, messages) {
  listNode.textContent = "";

  if (!messages.length) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "message-list__empty";
    emptyMessage.textContent = READY_MESSAGE;
    listNode.appendChild(emptyMessage);
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("li");
    item.className = `message message--${message.role}`;

    const role = document.createElement("p");
    role.className = "message__role";
    role.textContent = message.role === "user" ? "You" : "Assistant";

    const content = document.createElement("p");
    content.className = "message__content";
    content.textContent = message.content;

    const time = document.createElement("time");
    time.className = "message__time";
    time.dateTime = message.createdAt;
    time.textContent = formatTimestamp(message.createdAt);

    item.append(role, content, time);
    listNode.appendChild(item);
  });

  listNode.scrollTop = listNode.scrollHeight;
}

function hydrateState() {
  const saved = safeReadStorage(STORAGE_KEY_THREADS);
  if (!saved || typeof saved !== "object") {
    return;
  }

  const rawThreads = Array.isArray(saved.threads) ? saved.threads : [];
  state.threads = rawThreads.map((rawThread) => sanitizeThread(rawThread)).filter(Boolean);

  if (typeof saved.activeThreadId === "string") {
    state.activeThreadId = saved.activeThreadId;
  }
}

function sanitizeThread(rawThread) {
  if (!rawThread || typeof rawThread !== "object") {
    return null;
  }

  const createdAt = isValidDate(rawThread.createdAt) ? rawThread.createdAt : new Date().toISOString();
  const messages = sanitizeMessages(rawThread.messages, createdAt);

  return {
    id: isNonEmptyString(rawThread.id) ? rawThread.id : createId("thread"),
    title: isNonEmptyString(rawThread.title) ? rawThread.title : UNTITLED_TITLE,
    createdAt,
    updatedAt: isValidDate(rawThread.updatedAt) ? rawThread.updatedAt : createdAt,
    selectedModel: getValidSelectedModel(rawThread.selectedModel),
    minimized: Boolean(rawThread.minimized),
    messages: messages.length ? messages : [buildMessage("assistant", READY_MESSAGE, createdAt)],
  };
}

function sanitizeMessages(rawMessages, fallbackDate) {
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .filter((rawMessage) => rawMessage && typeof rawMessage === "object")
    .map((rawMessage) => {
      const content = isNonEmptyString(rawMessage.content) ? rawMessage.content.trim() : "";
      if (!content) {
        return null;
      }

      return {
        id: isNonEmptyString(rawMessage.id) ? rawMessage.id : createId("msg"),
        role: rawMessage.role === "user" ? "user" : "assistant",
        content,
        createdAt: isValidDate(rawMessage.createdAt) ? rawMessage.createdAt : fallbackDate,
      };
    })
    .filter(Boolean);
}

function persistState() {
  safeWriteStorage(STORAGE_KEY_THREADS, {
    threads: state.threads,
    activeThreadId: state.activeThreadId,
  });
}

function readPersistedModelOptions() {
  const saved = safeReadStorage(STORAGE_KEY_MODELS);
  if (!Array.isArray(saved)) {
    return [];
  }

  return saved
    .flatMap((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return [{ value: entry.trim(), label: entry.trim() }];
      }

      if (!entry || typeof entry !== "object") {
        return [];
      }

      const provider = isNonEmptyString(entry.provider) ? entry.provider.trim() : "custom";
      const modelName = extractModelNameFromRecord(entry);

      if (!modelName) {
        return [];
      }

      return [
        {
          value: `${provider}:${modelName}`,
          label: `${provider} / ${modelName}`,
        },
      ];
    })
    .filter((option) => isNonEmptyString(option.value));
}

function extractModelNameFromRecord(record) {
  if (isNonEmptyString(record.model)) {
    return record.model.trim();
  }

  if (record.config && typeof record.config === "object" && isNonEmptyString(record.config.model)) {
    return record.config.model.trim();
  }

  const endpoint = isNonEmptyString(record.endpoint)
    ? record.endpoint
    : record.config && typeof record.config === "object" && isNonEmptyString(record.config.endpoint)
      ? record.config.endpoint
      : "";

  return parseModelFromEndpoint(endpoint);
}

function buildModelOptionsFromPlugins(plugins) {
  if (!Array.isArray(plugins)) {
    return [];
  }

  return plugins
    .map((plugin) => {
      if (!plugin || typeof plugin !== "object") {
        return null;
      }

      const providerId = isNonEmptyString(plugin.id) ? plugin.id.trim() : "unknown";
      const modelName = resolvePluginModelName(plugin);

      if (!modelName) {
        return null;
      }

      return {
        value: `${providerId}:${modelName}`,
        label: `${providerId} / ${modelName}`,
      };
    })
    .filter(Boolean);
}

function resolvePluginModelName(plugin) {
  const fields = Array.isArray(plugin.fields) ? plugin.fields : [];
  const modelField = fields.find((field) => field && field.key === "model");

  if (modelField && isNonEmptyString(modelField.default)) {
    return modelField.default.trim();
  }

  const endpointField = fields.find((field) => field && field.key === "endpoint");
  if (endpointField && isNonEmptyString(endpointField.default)) {
    return parseModelFromEndpoint(endpointField.default);
  }

  return null;
}

function parseModelFromEndpoint(endpoint) {
  if (!isNonEmptyString(endpoint)) {
    return "";
  }

  const cleaned = endpoint.trim();
  const marker = "/models/";
  const markerIndex = cleaned.indexOf(marker);

  if (markerIndex !== -1) {
    const modelPath = cleaned.slice(markerIndex + marker.length).replace(/\/+$/, "");
    return modelPath || "";
  }

  try {
    const url = new URL(cleaned);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    const segments = cleaned.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  }
}

function dedupeModelOptions(options) {
  const map = new Map();

  options.forEach((option) => {
    if (!option || !isNonEmptyString(option.value)) {
      return;
    }

    const key = option.value.trim();
    if (!map.has(key)) {
      map.set(key, {
        value: key,
        label: isNonEmptyString(option.label) ? option.label.trim() : key,
      });
    }
  });

  return [...map.values()];
}

function populateModelSelect(selectNode, selectedValue) {
  selectNode.textContent = "";

  if (!availableModels.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No model presets available";
    selectNode.appendChild(option);
    selectNode.disabled = true;
    return;
  }

  availableModels.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    selectNode.appendChild(option);
  });

  selectNode.disabled = false;
  selectNode.value = getValidSelectedModel(selectedValue);
}

function getValidSelectedModel(candidate) {
  const hasCandidate = isNonEmptyString(candidate) && availableModels.some((option) => option.value === candidate);
  if (hasCandidate) {
    return candidate;
  }

  return availableModels[0]?.value || "";
}

function getFilteredThreads() {
  const query = state.query.trim().toLowerCase();
  if (!query) {
    return [...state.threads];
  }

  return state.threads.filter((thread) => {
    const searchText = [thread.title, thread.selectedModel, getThreadSnippet(thread)]
      .join(" ")
      .toLowerCase();

    return searchText.includes(query);
  });
}

function getThreadSnippet(thread) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  return lastMessage?.content || READY_MESSAGE;
}

function getActiveThread() {
  return findThreadById(state.activeThreadId);
}

function findThreadById(threadId) {
  return state.threads.find((thread) => thread.id === threadId) || null;
}

function moveThreadToTop(threadId) {
  const index = state.threads.findIndex((thread) => thread.id === threadId);
  if (index <= 0) {
    return;
  }

  const [thread] = state.threads.splice(index, 1);
  state.threads.unshift(thread);
}

function sortThreadsByRecency() {
  state.threads.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildMessage(role, content, createdAt) {
  return {
    id: createId("msg"),
    role,
    content,
    createdAt,
  };
}

function buildThreadTitle(messageText) {
  const clean = messageText.trim();
  if (clean.length <= 42) {
    return clean;
  }

  return `${clean.slice(0, 39)}...`;
}

function formatTimestamp(value) {
  if (!isValidDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function focusComposer() {
  window.requestAnimationFrame(() => {
    const input = elements.threadStage.querySelector('[data-role="composer-input"]');
    if (!input || input.closest("[hidden]")) {
      return;
    }

    input.focus();
  });
}

function safeReadStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write errors so the UI still works when storage is unavailable.
  }
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}