import { providerPlugins } from "../llm-config-platform/src/providers/catalog.js";
import {
  isIndexedDbSupported,
  loadLegacyThreadsState,
  loadModelPresetRecords,
  loadThreadsFromIndexedDb,
  loadUiState,
  migrateLegacyLocalStorageToIndexedDb,
  openThreadsDatabase,
  saveLegacyThreadsState,
  saveUiState,
  upsertThreadRecord,
  upsertThreadWithMessages,
} from "./storage.js";
import { renderThreadList, renderThreadPanels } from "./view.js";

const UNTITLED_TITLE = "Untitled Thread";
const READY_MESSAGE = "Ready when you are.";

const state = {
  threads: [],
  activeThreadId: null,
  query: "",
  db: null,
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

let writeQueue = Promise.resolve();

void initialize();

async function initialize() {
  if (!hasRequiredElements()) {
    return;
  }

  bindEvents();
  await hydrateState();

  // Landing experience: start with no open thread columns.
  state.threads.forEach((thread) => {
    thread.isOpen = false;
  });
  state.activeThreadId = null;

  persistUiState();
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
    persistUiState();
    render();
  });

  elements.threadList.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="select-thread"]');
    if (!button) {
      return;
    }

    const { threadId } = button.dataset;
    if (!threadId) {
      return;
    }

    const thread = findThreadById(threadId);
    if (!thread) {
      return;
    }

    if (!thread.isOpen) {
      thread.isOpen = true;
      persistThreadAsync(thread, { syncMessages: false });
    }

    state.activeThreadId = threadId;
    persistUiState();
    render();
    focusComposer(threadId);
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
    isOpen: true,
    messages: [buildMessage("assistant", READY_MESSAGE, now)],
  };

  state.threads.unshift(thread);
  state.activeThreadId = thread.id;
  persistUiState();
  persistThreadAsync(thread, { syncMessages: true });
  render();
  focusComposer(thread.id);
}

function handleThreadStageClick(event) {
  const button = event.target.closest('button[data-action="minimize-thread"]');
  if (!button) {
    return;
  }

  const thread = getThreadFromEventTarget(button);
  if (!thread) {
    return;
  }

  thread.isOpen = false;

  if (state.activeThreadId === thread.id) {
    const nextOpenThread = state.threads.find(
      (candidate) => candidate.id !== thread.id && candidate.isOpen
    );
    state.activeThreadId = nextOpenThread?.id || null;
  }

  persistUiState();
  persistThreadAsync(thread, { syncMessages: false });
  render();
}

function handleThreadStageChange(event) {
  const select = event.target.closest('select[data-action="select-model"]');
  if (!select) {
    return;
  }

  const thread = getThreadFromEventTarget(select);
  if (!thread) {
    return;
  }

  thread.selectedModel = select.value;
  thread.updatedAt = new Date().toISOString();
  moveThreadToTop(thread.id);
  state.activeThreadId = thread.id;

  persistUiState();
  persistThreadAsync(thread, { syncMessages: false });
  render();
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

  const thread = getThreadFromEventTarget(form);
  if (!thread) {
    return;
  }

  input.value = "";

  const now = new Date().toISOString();
  thread.messages.push(buildMessage("user", messageText, now));
  thread.updatedAt = now;
  thread.isOpen = true;

  if (thread.title === UNTITLED_TITLE) {
    thread.title = buildThreadTitle(messageText);
  }

  moveThreadToTop(thread.id);
  state.activeThreadId = thread.id;

  persistUiState();
  persistThreadAsync(thread, { syncMessages: true });
  render();
  focusComposer(thread.id);
}

function render() {
  sortThreadsByRecency();
  const filteredThreads = getFilteredThreads();

  renderThreadList({
    threadListNode: elements.threadList,
    threadListEmptyNode: elements.threadListEmpty,
    threads: filteredThreads,
    allThreadCount: state.threads.length,
    activeThreadId: state.activeThreadId,
    getThreadSnippet,
  });

  renderThreadPanels({
    threadStageNode: elements.threadStage,
    emptyStateNode: elements.emptyState,
    threadTemplate: elements.threadTemplate,
    openThreads: state.threads.filter((thread) => thread.isOpen),
    activeThreadId: state.activeThreadId,
    availableModels,
    getValidSelectedModel,
    readyMessage: READY_MESSAGE,
  });
}

async function hydrateState() {
  hydrateUiState();

  if (state.query) {
    elements.searchInput.value = state.query;
  }

  if (!isIndexedDbSupported()) {
    hydrateLegacyThreadsState();
    return;
  }

  try {
    state.db = await openThreadsDatabase();
    const migratedActiveThreadId = await migrateLegacyLocalStorageToIndexedDb(
      state.db,
      sanitizeThread
    );

    if (!state.activeThreadId && isNonEmptyString(migratedActiveThreadId)) {
      state.activeThreadId = migratedActiveThreadId;
      persistUiState();
    }

    state.threads = await loadThreadsFromIndexedDb(state.db, sanitizeThread);
  } catch (error) {
    console.warn("IndexedDB unavailable, falling back to localStorage snapshot.", error);
    state.db = null;
    hydrateLegacyThreadsState();
  }
}

function hydrateUiState() {
  const uiState = loadUiState();
  if (!uiState) {
    return;
  }

  if (isNonEmptyString(uiState.activeThreadId)) {
    state.activeThreadId = uiState.activeThreadId;
  }

  if (isNonEmptyString(uiState.query)) {
    state.query = uiState.query.trim();
  }
}

function hydrateLegacyThreadsState() {
  const saved = loadLegacyThreadsState();
  if (!saved) {
    return;
  }

  const rawThreads = Array.isArray(saved.threads) ? saved.threads : [];
  state.threads = rawThreads.map((rawThread) => sanitizeThread(rawThread)).filter(Boolean);
  sortThreadsByRecency();

  if (!state.activeThreadId && isNonEmptyString(saved.activeThreadId)) {
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
    isOpen: typeof rawThread.isOpen === "boolean" ? rawThread.isOpen : false,
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

function persistUiState() {
  saveUiState({
    activeThreadId: state.activeThreadId,
    query: state.query,
  });
}

function persistThreadAsync(thread, options = { syncMessages: true }) {
  if (!thread) {
    return;
  }

  if (state.db) {
    const { syncMessages } = options;

    queueWrite(async () => {
      if (syncMessages) {
        await upsertThreadWithMessages(state.db, thread);
      } else {
        await upsertThreadRecord(state.db, thread);
      }
    });

    return;
  }

  persistLegacyThreadsSnapshot();
}

function queueWrite(writeTask) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(writeTask)
    .catch((error) => {
      console.warn("Unable to persist thread update.", error);
    });
}

function persistLegacyThreadsSnapshot() {
  saveLegacyThreadsState({
    threads: state.threads,
    activeThreadId: state.activeThreadId,
  });
}

function readPersistedModelOptions() {
  const saved = loadModelPresetRecords();

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

function getValidSelectedModel(candidate) {
  const hasCandidate =
    isNonEmptyString(candidate) && availableModels.some((option) => option.value === candidate);
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

function findThreadById(threadId) {
  return state.threads.find((thread) => thread.id === threadId) || null;
}

function getThreadFromEventTarget(target) {
  if (!target || typeof target.closest !== "function") {
    return null;
  }

  const panel = target.closest(".thread-panel");
  const threadId = panel?.dataset.threadId || target.dataset?.threadId;

  if (!threadId) {
    return null;
  }

  return findThreadById(threadId);
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

function focusComposer(threadId = state.activeThreadId) {
  window.requestAnimationFrame(() => {
    const selector = threadId
      ? `.thread-panel[data-thread-id="${threadId}"] [data-role="composer-input"]`
      : '[data-role="composer-input"]';
    const input = elements.threadStage.querySelector(selector);
    if (!input || input.closest("[hidden]")) {
      return;
    }

    input.focus();
  });
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
