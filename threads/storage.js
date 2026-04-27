const DB_NAME = "haval.threads.db";
const DB_VERSION = 1;
const STORE_THREADS = "threads";
const STORE_MESSAGES = "messages";

const STORAGE_KEY_THREADS_LEGACY = "haval.threads.v1";
const STORAGE_KEY_MODELS = "haval.model-presets.v1";
const STORAGE_KEY_UI = "haval.threads.ui.v1";

export function isIndexedDbSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function loadUiState() {
  const uiState = readStorageJson(STORAGE_KEY_UI);
  return uiState && typeof uiState === "object" ? uiState : null;
}

export function saveUiState(uiState) {
  writeStorageJson(STORAGE_KEY_UI, uiState);
}

export function loadLegacyThreadsState() {
  const state = readStorageJson(STORAGE_KEY_THREADS_LEGACY);
  return state && typeof state === "object" ? state : null;
}

export function saveLegacyThreadsState(state) {
  writeStorageJson(STORAGE_KEY_THREADS_LEGACY, state);
}

export function clearLegacyThreadsState() {
  window.localStorage.removeItem(STORAGE_KEY_THREADS_LEGACY);
}

export function loadModelPresetRecords() {
  const records = readStorageJson(STORAGE_KEY_MODELS);
  return Array.isArray(records) ? records : [];
}

export async function openThreadsDatabase() {
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
        messageStore.createIndex("threadIdCreatedAt", ["threadId", "createdAt"], {
          unique: false,
        });
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

export async function loadThreadsFromIndexedDb(db, sanitizeThread) {
  const threadRecords = await getAllThreadRecords(db);

  const hydratedThreads = await Promise.all(
    threadRecords.map(async (threadRecord) => {
      const messageRecords = await getMessagesForThread(db, threadRecord.id);
      return sanitizeThread({ ...threadRecord, messages: messageRecords });
    })
  );

  return hydratedThreads.filter(Boolean);
}

export async function migrateLegacyLocalStorageToIndexedDb(db, sanitizeThread) {
  const legacyState = loadLegacyThreadsState();
  if (!legacyState) {
    return null;
  }

  const existingCount = await countStoreRecords(db, STORE_THREADS);
  if (existingCount > 0) {
    return null;
  }

  const legacyThreads = Array.isArray(legacyState.threads) ? legacyState.threads : [];
  const sanitizedThreads = legacyThreads.map((thread) => sanitizeThread(thread)).filter(Boolean);

  if (!sanitizedThreads.length) {
    clearLegacyThreadsState();
    return null;
  }

  for (const thread of sanitizedThreads) {
    await upsertThreadWithMessages(db, thread);
  }

  clearLegacyThreadsState();

  return typeof legacyState.activeThreadId === "string" ? legacyState.activeThreadId : null;
}

export async function upsertThreadRecord(db, thread) {
  const transaction = db.transaction(STORE_THREADS, "readwrite");
  const done = waitForTransaction(transaction);
  const store = transaction.objectStore(STORE_THREADS);
  store.put(toThreadRecord(thread));
  await done;
}

export async function upsertThreadWithMessages(db, thread) {
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

function readStorageJson(key) {
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

function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors so the UI still works when storage is unavailable.
  }
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
