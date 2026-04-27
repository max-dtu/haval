import { providerPlugins } from "../llm-config-platform/src/providers/catalog.js";

const DB_NAME = "haval.threads.db";
const DB_VERSION = 1;
const STORE_THREADS = "threads";
const STORE_MESSAGES = "messages";

const STORAGE_KEY_THREADS_LEGACY = "haval.threads.v1";
const STORAGE_KEY_MODELS = "haval.model-presets.v1";
const STORAGE_KEY_UI = "haval.threads.ui.v1";

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
    renderThreadList();
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
  renderThreadList();
  renderThreadPanels();
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

    if (thread.isOpen) {
      button.classList.add("thread-list__button--open");
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

function renderThreadPanels() {
  const openThreads = state.threads.filter((thread) => thread.isOpen);
  elements.threadStage.textContent = "";

  if (!openThreads.length) {
    elements.emptyState.hidden = false;
    return;
  }

  elements.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();

  openThreads.forEach((thread) => {
    const panelFragment = elements.threadTemplate.content.cloneNode(true);
    const panel = panelFragment.querySelector(".thread-panel");
    const title = panelFragment.querySelector('[data-role="thread-title"]');
    const timestamp = panelFragment.querySelector('[data-role="thread-timestamp"]');
    const modelSelect = panelFragment.querySelector('select[data-action="select-model"]');
    const modelField = panelFragment.querySelector(".thread-panel__model-field");
    const messageList = panelFragment.querySelector('[data-role="message-list"]');
    const composerLabel = panelFragment.querySelector('[data-role="composer-label"]');
    const composerInput = panelFragment.querySelector('[data-role="composer-input"]');
    const minimizeButton = panelFragment.querySelector('button[data-action="minimize-thread"]');

    if (!panel || !title || !timestamp || !modelSelect || !modelField || !messageList || !composerInput || !minimizeButton) {
      return;
    }

    panel.dataset.threadId = thread.id;
    panel.dataset.state = "expanded";

    if (thread.id === state.activeThreadId) {
      panel.dataset.active = "true";
    }

    title.textContent = thread.title;

    const firstMessage = thread.messages[0];
    const startedAt = firstMessage?.createdAt || thread.createdAt;

    timestamp.dateTime = startedAt;
    timestamp.textContent = `Started ${formatTimestamp(startedAt)}`;

    const selectedModel = getValidSelectedModel(thread.selectedModel);
    thread.selectedModel = selectedModel;
    populateModelSelect(modelSelect, selectedModel);
    modelField.hidden = availableModels.length === 0;

    const composerInputId = `thread-message-input-${thread.id}`;
    composerInput.id = composerInputId;
    if (composerLabel) {
      composerLabel.htmlFor = composerInputId;
    }

    minimizeButton.textContent = "-";
    minimizeButton.setAttribute("aria-label", "Minimize chat to sidebar");
    minimizeButton.dataset.threadId = thread.id;

    renderMessages(messageList, thread.messages);
    fragment.appendChild(panelFragment);
  });

  elements.threadStage.appendChild(fragment);
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
    await migrateLegacyLocalStorageToIndexedDb(state.db);
    state.threads = await loadThreadsFromIndexedDb(state.db);
  } catch (error) {
    console.warn("IndexedDB unavailable, falling back to localStorage snapshot.", error);
    state.db = null;
    hydrateLegacyThreadsState();
  }
}

function hydrateUiState() {
  const uiState = safeReadStorage(STORAGE_KEY_UI);
  if (!uiState || typeof uiState !== "object") {
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
  const saved = safeReadStorage(STORAGE_KEY_THREADS_LEGACY);
  if (!saved || typeof saved !== "object") {
    return;
  }

  const rawThreads = Array.isArray(saved.threads) ? saved.threads : [];
  state.threads = rawThreads.map((rawThread) => sanitizeThread(rawThread)).filter(Boolean);
  sortThreadsByRecency();

  if (!state.activeThreadId && isNonEmptyString(saved.activeThreadId)) {
    state.activeThreadId = saved.activeThreadId;
  }
}

async function loadThreadsFromIndexedDb(db) {
  const threadRecords = await getAllThreadRecords(db);

  const hydratedThreads = await Promise.all(
    threadRecords.map(async (threadRecord) => {
      const messageRecords = await getMessagesForThread(db, threadRecord.id);
      return sanitizeThread({ ...threadRecord, messages: messageRecords });
    })
  );

  return hydratedThreads.filter(Boolean);
}

async function migrateLegacyLocalStorageToIndexedDb(db) {
  const legacyState = safeReadStorage(STORAGE_KEY_THREADS_LEGACY);
  if (!legacyState || typeof legacyState !== "object") {
    return;
  }

  const existingCount = await countStoreRecords(db, STORE_THREADS);
  if (existingCount > 0) {
    return;
  }

  const legacyThreads = Array.isArray(legacyState.threads) ? legacyState.threads : [];
  const sanitizedThreads = legacyThreads.map((thread) => sanitizeThread(thread)).filter(Boolean);

  if (!sanitizedThreads.length) {
    window.localStorage.removeItem(STORAGE_KEY_THREADS_LEGACY);
    return;
  }

  for (const thread of sanitizedThreads) {
    await upsertThreadWithMessages(db, thread);
  }

  if (!state.activeThreadId && isNonEmptyString(legacyState.activeThreadId)) {
    state.activeThreadId = legacyState.activeThreadId;
    persistUiState();
  }

  window.localStorage.removeItem(STORAGE_KEY_THREADS_LEGACY);
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
  safeWriteStorage(STORAGE_KEY_UI, {
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
  safeWriteStorage(STORAGE_KEY_THREADS_LEGACY, {
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
    const searchText = [thread.title, thread.selectedModel, getThreadSnippet(thread)].join(" ").toLowerCase();
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

function isIndexedDbSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

async function openThreadsDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_THREADS)) {
        const threadStore = db.createObjectStore(STORE_THREADS, { keyPath: "id" });
        threadStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messageStore = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" });
        messageStore.createIndex("threadId", "threadId", { unique: false });
        messageStore.createIndex("threadIdCreatedAt", ["threadId", "createdAt"], { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Unable to open IndexedDB."));
    };
  });
}

async function getAllThreadRecords(db) {
  const transaction = db.transaction(STORE_THREADS, "readonly");
  const done = waitForTransaction(transaction);
  const store = transaction.objectStore(STORE_THREADS);
  const records = await requestToPromise(store.getAll());
  await done;

  const result = Array.isArray(records) ? records : [];
  result.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  return result;
}

async function getMessagesForThread(db, threadId) {
  const transaction = db.transaction(STORE_MESSAGES, "readonly");
  const done = waitForTransaction(transaction);
  const store = transaction.objectStore(STORE_MESSAGES);
  const threadIndex = store.index("threadId");
  const records = await requestToPromise(threadIndex.getAll(IDBKeyRange.only(threadId)));
  await done;

  const result = Array.isArray(records) ? records : [];
  result.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return result;
}

async function countStoreRecords(db, storeName) {
  const transaction = db.transaction(storeName, "readonly");
  const done = waitForTransaction(transaction);
  const store = transaction.objectStore(storeName);
  const count = await requestToPromise(store.count());
  await done;
  return Number(count || 0);
}

async function upsertThreadRecord(db, thread) {
  const transaction = db.transaction(STORE_THREADS, "readwrite");
  const done = waitForTransaction(transaction);
  const store = transaction.objectStore(STORE_THREADS);
  store.put(toThreadRecord(thread));
  await done;
}

async function upsertThreadWithMessages(db, thread) {
  const transaction = db.transaction([STORE_THREADS, STORE_MESSAGES], "readwrite");
  const done = waitForTransaction(transaction);

  const threadStore = transaction.objectStore(STORE_THREADS);
  const messageStore = transaction.objectStore(STORE_MESSAGES);

  threadStore.put(toThreadRecord(thread));

  await clearMessagesForThread(messageStore, thread.id);
  thread.messages.forEach((message) => {
    messageStore.put(toMessageRecord(message, thread.id));
  });

  await done;
}

function clearMessagesForThread(messageStore, threadId) {
  return new Promise((resolve, reject) => {
    const index = messageStore.index("threadId");
    const request = index.openCursor(IDBKeyRange.only(threadId));

    request.onerror = () => {
      reject(request.error || new Error("Unable to read existing messages."));
    };

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (!cursor) {
        resolve();
        return;
      }

      const deleteRequest = cursor.delete();
      deleteRequest.onerror = () => {
        reject(deleteRequest.error || new Error("Unable to remove old message."));
      };
      deleteRequest.onsuccess = () => {
        cursor.continue();
      };
    };
  });
}

function toThreadRecord(thread) {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    selectedModel: thread.selectedModel,
    isOpen: thread.isOpen,
  };
}

function toMessageRecord(message, threadId) {
  return {
    id: message.id,
    threadId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("IndexedDB request failed."));
    };
  });
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error || new Error("IndexedDB transaction failed."));
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error("IndexedDB transaction aborted."));
    };
  });
}
