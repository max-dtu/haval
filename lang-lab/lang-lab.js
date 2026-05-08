import { CreateMLCEngine } from "@mlc-ai/web-llm";
import initSqlJs from "sql.js";

const IDB_NAME = "haval.lang-lab.v1";
const IDB_VERSION = 1;
const STORE_NAME = "sqlite";

const DEFAULT_MODEL = "Llama-3-8B-Instruct-q4f32_1";

const state = {
  sql: null,
  db: null,
  engine: null,
  isModelLoading: false,
  modelLoadProgress: 0,
  conversations: [],
  activeConversationId: null,
  messages: [],
  isGenerating: false,
};

const elements = {
  conversationList: document.querySelector('[data-role="conversation-list"]'),
  conversationListEmpty: document.querySelector('[data-role="conversation-list-empty"]'),
  modelLoader: document.querySelector('[data-role="model-loader"]'),
  modelSelect: document.querySelector('[data-role="model-select"]'),
  modelProgress: document.querySelector('[data-role="model-progress"]'),
  modelProgressBar: document.querySelector('[data-role="model-progress-bar"]'),
  modelStatus: document.querySelector('[data-role="model-status"]'),
  chatBody: document.querySelector('[data-role="chat-body"]'),
  chatTitle: document.querySelector('[data-role="chat-title"]'),
  messageList: document.querySelector('[data-role="message-list"]'),
  composerForm: document.querySelector('form[data-action="send-message"]'),
  composerTextarea: document.querySelector('textarea[data-action="input-message"]'),
};

init();

async function init() {
  bindEvents();
  try {
    await initDatabase();
    loadConversations();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
  render();
}

function bindEvents() {
  document.querySelector('button[data-action="new-conversation"]')?.addEventListener("click", handleNewConversation);
  document.querySelector('button[data-action="load-model"]')?.addEventListener("click", handleLoadModel);
  elements.conversationList?.addEventListener("click", handleConversationListClick);
  elements.composerForm?.addEventListener("submit", handleSendMessage);
  elements.composerTextarea?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.composerForm?.dispatchEvent(new Event("submit"));
    }
  });
  elements.composerTextarea?.addEventListener("input", (event) => {
    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

async function initDatabase() {
  state.sql = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`,
  });
  state.db = await loadOrCreateDatabase(state.sql);
}

async function loadOrCreateDatabase(sql) {
  const idb = await openIndexedDb();
  const tx = idb.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const data = await requestToPromise(store.get("db"));
  await waitForTransaction(tx);

  if (data) {
    return new sql.Database(data);
  }

  const db = new sql.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

async function persistDatabase() {
  if (!state.db) return;
  try {
    const data = state.db.export();
    const idb = await openIndexedDb();
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(data, "db");
    await waitForTransaction(tx);
  } catch (error) {
    console.error("Failed to persist database:", error);
  }
}

function getConversations() {
  if (!state.db) return [];
  const stmt = state.db.prepare(
    "SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
  );
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id,
      title: row.title,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  stmt.free();
  return results;
}

function getMessages(conversationId) {
  if (!state.db || !conversationId) return [];
  const stmt = state.db.prepare(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  );
  stmt.bind([conversationId]);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    });
  }
  stmt.free();
  return results;
}

function createConversation(title, model) {
  const id = makeId();
  const now = nowIso();
  state.db.run(
    "INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, title, model, now, now]
  );
  return { id, title, model, createdAt: now, updatedAt: now };
}

function createMessage(conversationId, role, content) {
  const id = makeId();
  const now = nowIso();
  state.db.run(
    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, conversationId, role, content, now]
  );
  state.db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conversationId]);
  return { id, role, content, createdAt: now };
}

function updateMessageContent(id, content) {
  state.db.run("UPDATE messages SET content = ? WHERE id = ?", [content, id]);
}

function removeConversation(id) {
  state.db.run("DELETE FROM messages WHERE conversation_id = ?", [id]);
  state.db.run("DELETE FROM conversations WHERE id = ?", [id]);
}

function loadConversations() {
  state.conversations = getConversations();
  if (state.conversations.length) {
    state.activeConversationId = state.conversations[0].id;
    state.messages = getMessages(state.activeConversationId);
  }
}

async function loadModel(modelId) {
  if (state.isModelLoading || state.engine) return;
  state.isModelLoading = true;
  state.modelLoadProgress = 0;
  render();

  try {
    state.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        state.modelLoadProgress = Math.round(report.progress * 100);
        render();
      },
    });
    state.isModelLoading = false;
    render();
  } catch (error) {
    state.isModelLoading = false;
    state.engine = null;
    console.error("Failed to load model:", error);
    render();
  }
}

async function streamChat(messages, onChunk) {
  if (!state.engine) return "";

  const stream = await state.engine.chat.completions.create({
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
  });

  let fullContent = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    fullContent += text;
    onChunk(text);
  }

  return fullContent;
}

function handleNewConversation() {
  const model = state.engine ? (elements.modelSelect?.value || DEFAULT_MODEL) : DEFAULT_MODEL;
  const conversation = createConversation(`Chat ${state.conversations.length + 1}`, model);
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  state.messages = [];
  persistDatabase();
  render();
}

function handleConversationListClick(event) {
  const deleteButton = event.target.closest('button[data-action="delete-conversation"]');
  if (deleteButton) {
    event.stopPropagation();
    const id = deleteButton.dataset.conversationId;
    removeConversation(id);
    state.conversations = state.conversations.filter((c) => c.id !== id);
    if (state.activeConversationId === id) {
      state.activeConversationId = state.conversations[0]?.id || null;
      state.messages = state.activeConversationId ? getMessages(state.activeConversationId) : [];
    }
    persistDatabase();
    render();
    return;
  }

  const selectButton = event.target.closest('button[data-action="select-conversation"]');
  if (!selectButton) return;

  const id = selectButton.dataset.conversationId;
  state.activeConversationId = id;
  state.messages = getMessages(id);
  render();
}

async function handleLoadModel() {
  const modelId = elements.modelSelect?.value || DEFAULT_MODEL;
  await loadModel(modelId);
}

async function handleSendMessage(event) {
  event.preventDefault();
  if (state.isGenerating || !state.engine) return;

  const textarea = elements.composerTextarea;
  const content = textarea?.value?.trim();
  if (!content) return;

  if (!state.activeConversationId) {
    handleNewConversation();
  }

  const userMsg = createMessage(state.activeConversationId, "user", content);
  state.messages.push(userMsg);
  textarea.value = "";
  textarea.style.height = "auto";
  state.isGenerating = true;
  persistDatabase();
  render();

  const dbMessages = getMessages(state.activeConversationId);
  const assistantMsg = createMessage(state.activeConversationId, "assistant", "");
  state.messages.push({ ...assistantMsg, content: "" });
  persistDatabase();
  render();

  try {
    await streamChat(dbMessages, (chunk) => {
      assistantMsg.content += chunk;
      updateMessageContent(assistantMsg.id, assistantMsg.content);
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg.id === assistantMsg.id) {
        lastMsg.content = assistantMsg.content;
      }
      renderStreamingUpdate(assistantMsg.content);
    });
    persistDatabase();
  } catch (error) {
    console.error("Chat error:", error);
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg.id === assistantMsg.id) {
      lastMsg.content += `\n\n[Error: ${error.message}]`;
      updateMessageContent(assistantMsg.id, lastMsg.content);
    }
    persistDatabase();
  } finally {
    state.isGenerating = false;
    persistDatabase();
    render();
  }
}

function render() {
  renderSidebar();
  renderModelLoader();
  renderChat();
}

function renderSidebar() {
  if (!elements.conversationList || !elements.conversationListEmpty) return;

  elements.conversationList.textContent = "";

  if (!state.conversations.length) {
    elements.conversationListEmpty.hidden = false;
    return;
  }

  elements.conversationListEmpty.hidden = true;
  const fragment = document.createDocumentFragment();

  state.conversations.forEach((conversation) => {
    const item = document.createElement("li");
    item.className = "sidebar__item";

    const button = document.createElement("button");
    button.className = "sidebar__button";
    button.type = "button";
    button.dataset.action = "select-conversation";
    button.dataset.conversationId = conversation.id;
    if (conversation.id === state.activeConversationId) {
      button.classList.add("sidebar__button--active");
    }
    button.textContent = conversation.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "sidebar__delete";
    deleteBtn.type = "button";
    deleteBtn.dataset.action = "delete-conversation";
    deleteBtn.dataset.conversationId = conversation.id;
    deleteBtn.setAttribute("aria-label", `Delete ${conversation.title}`);
    deleteBtn.textContent = "×";

    item.append(button, deleteBtn);
    fragment.appendChild(item);
  });

  elements.conversationList.appendChild(fragment);
}

function renderModelLoader() {
  if (!elements.modelLoader) return;

  if (state.engine) {
    elements.modelLoader.hidden = true;
    if (elements.chatBody) elements.chatBody.hidden = false;
    return;
  }

  elements.modelLoader.hidden = false;
  if (elements.chatBody) elements.chatBody.hidden = true;

  if (elements.modelProgress) {
    elements.modelProgress.hidden = !state.isModelLoading;
  }
  if (elements.modelProgressBar) {
    elements.modelProgressBar.style.width = `${state.modelLoadProgress}%`;
  }
  if (elements.modelStatus) {
    if (state.isModelLoading) {
      elements.modelStatus.textContent = `Loading model… ${state.modelLoadProgress}%`;
    } else {
      elements.modelStatus.textContent = "Select a model and click Load Model to start chatting.";
    }
  }

  const loadButton = document.querySelector('button[data-action="load-model"]');
  if (loadButton) {
    loadButton.disabled = state.isModelLoading;
  }
}

function renderChat() {
  if (!state.engine || !elements.chatBody) return;

  const conversation = state.conversations.find((c) => c.id === state.activeConversationId);
  if (elements.chatTitle) {
    elements.chatTitle.textContent = conversation?.title || "Chat";
  }

  renderMessages();

  if (elements.composerTextarea) {
    elements.composerTextarea.disabled = state.isGenerating;
  }
  const submitBtn = elements.composerForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = state.isGenerating;
  }
}

function renderMessages() {
  if (!elements.messageList) return;
  elements.messageList.textContent = "";

  if (!state.messages.length && !state.isGenerating) {
    const empty = document.createElement("div");
    empty.className = "chat__empty";
    empty.textContent = "Send a message to start chatting.";
    elements.messageList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message message--${message.role}`;
    article.dataset.role = message.role;

    const avatar = document.createElement("div");
    avatar.className = "message__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = message.role === "user" ? "Y" : "A";

    const content = document.createElement("div");
    content.className = "message__content";

    const meta = document.createElement("div");
    meta.className = "message__meta";
    meta.textContent = message.role === "user" ? "You" : "Assistant";

    const bubble = document.createElement("div");
    bubble.className = "message__bubble";
    bubble.textContent = message.content;

    const time = document.createElement("time");
    time.className = "message__time";
    time.dateTime = message.createdAt;
    time.textContent = formatTimestamp(message.createdAt);

    content.append(meta, bubble, time);
    article.append(avatar, content);
    fragment.appendChild(article);
  });

  elements.messageList.appendChild(fragment);
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

function renderStreamingUpdate(content) {
  if (!elements.messageList) return;
  const articles = elements.messageList.querySelectorAll(".message");
  const lastArticle = articles[articles.length - 1];
  if (lastArticle) {
    const bubble = lastArticle.querySelector(".message__bubble");
    if (bubble) bubble.textContent = content;
  }
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatTimestamp(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
