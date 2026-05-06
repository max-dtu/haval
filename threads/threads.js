
import {
  deleteThreadWithMessages,
  loadModelPresetRecords,
  loadThreadsFromIndexedDb,
  migrateLegacyLocalStorageToIndexedDb,
  openThreadsDatabase,
  upsertThreadWithMessages,
} from "./storage.js";
import {
  buildAvailableModels,
  createThreadSanitizer,
  filterThreads,
  getClosestEventTarget,
  getThreadSnippet,
  makeId,
  nowIso,
  shouldPersistThread,
} from "./threadHelpers.js";
import { renderThreadList, renderThreadPanels } from "./view.js";

const READY_MESSAGE = "Send a message to start this thread.";

const elements = {
  newThreadButton: document.querySelector('button[data-action="new-thread"]'),
  searchInput: document.querySelector('[data-role="thread-search-input"]'),
  threadListNode: document.querySelector('[data-role="thread-list"]'),
  threadListEmptyNode: document.querySelector('[data-role="thread-list-empty"]'),
  threadStageNode: document.querySelector('[data-role="thread-stage"]'),
  emptyStateNode: document.querySelector('[data-role="empty-state"]'),
  threadTemplate: document.querySelector("#thread"),
  configDialog: document.querySelector('[data-role="config-dialog"]'),
  configIframe: document.querySelector('[data-role="config-iframe"]'),
  closeConfigButton: document.querySelector('button[data-action="close-config-dialog"]'),
};

const state = {
  db: null,
  threads: [],
  activeThreadId: null,
  searchQuery: "",
  availableModels: buildAvailableModels(loadModelPresetRecords()),
};
const sanitizeThread = createThreadSanitizer(getValidSelectedModel);

init();

async function init() {
  bindEvents();
  await hydrateThreads();
  render();
}

function bindEvents() {
  elements.newThreadButton?.addEventListener("click", handleNewThread);
  elements.searchInput?.addEventListener("input", handleSearchInput);
  elements.threadListNode?.addEventListener("click", handleThreadListClick);
  elements.threadStageNode?.addEventListener("click", handleThreadStageClick);
  elements.threadStageNode?.addEventListener("change", handleThreadStageChange);
  elements.threadStageNode?.addEventListener("submit", handleThreadStageSubmit);
  elements.closeConfigButton?.addEventListener("click", handleCloseConfig);
}

async function hydrateThreads() {
  try {
    state.db = await openThreadsDatabase();

    const migratedActiveThreadId = await migrateLegacyLocalStorageToIndexedDb(
      state.db,
      sanitizeThread
    );

    const hydratedThreads = await loadThreadsFromIndexedDb(state.db, sanitizeThread);
    const emptyThreadIds = hydratedThreads
      .filter((thread) => !shouldPersistThread(thread))
      .map((thread) => thread.id);

    if (emptyThreadIds.length) {
      await Promise.all(
        emptyThreadIds.map(async (threadId) => {
          try {
            await deleteThreadWithMessages(state.db, threadId);
          } catch {
            // Keep hydration resilient even if one cleanup delete fails.
          }
        })
      );
    }

    state.threads = hydratedThreads.filter((thread) => shouldPersistThread(thread));
    state.activeThreadId = pickExistingThreadId(migratedActiveThreadId);
  } catch {
    state.db = null;
    state.threads = [];
    state.activeThreadId = null;
  }
}

function render() {
  if (
    !elements.threadListNode ||
    !elements.threadListEmptyNode ||
    !elements.threadStageNode ||
    !elements.emptyStateNode ||
    !elements.threadTemplate
  ) {
    return;
  }

  const visibleThreads = filterThreads(state.threads, state.searchQuery);

  renderThreadList({
    threadListNode: elements.threadListNode,
    threadListEmptyNode: elements.threadListEmptyNode,
    threads: visibleThreads,
    allThreadCount: state.threads.length,
    activeThreadId: state.activeThreadId,
    getThreadSnippet,
  });

  renderThreadPanels({
    threadStageNode: elements.threadStageNode,
    emptyStateNode: elements.emptyStateNode,
    threadTemplate: elements.threadTemplate,
    openThreads: state.threads.filter((thread) => thread.isOpen),
    activeThreadId: state.activeThreadId,
    availableModels: state.availableModels,
    getValidSelectedModel,
    readyMessage: READY_MESSAGE,
  });
}

function handleSearchInput(event) {
  state.searchQuery = typeof event.target?.value === "string" ? event.target.value : "";
  render();
}

function handleNewThread() {
  const timestamp = nowIso();
  const threadId = makeId();
  const nextThread = {
    id: threadId,
    title: `Thread ${state.threads.length + 1}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    selectedModel: getValidSelectedModel(""),
    messages: [],
    isOpen: true,
  };

  state.threads = [nextThread, ...state.threads];
  state.activeThreadId = nextThread.id;
  render();
}

function handleThreadListClick(event) {
  const deleteButton = getClosestEventTarget(event.target, 'button[data-action="delete-thread"]');
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    void removeThread(deleteButton.dataset.threadId);
    return;
  }

  const selectButton = getClosestEventTarget(event.target, 'button[data-action="select-thread"]');
  if (!selectButton) {
    return;
  }

  const thread = getThreadById(selectButton.dataset.threadId);
  if (!thread) {
    return;
  }

  thread.isOpen = true;
  state.activeThreadId = thread.id;
  void persistThread(thread);
  render();
}

function handleThreadStageClick(event) {
  const openConfigContext = getStageContext(event.target, 'button[data-action="open-config"]');
  if (openConfigContext) {
    openThreadConfig(openConfigContext.thread);
    return;
  }

  const stageContext = getStageContext(event.target, 'button[data-action="minimize-thread"]');
  if (!stageContext) {
    return;
  }
  const { thread } = stageContext;

  thread.isOpen = false;
  if (state.activeThreadId === thread.id) {
    state.activeThreadId = state.threads.find((item) => item.isOpen)?.id || null;
  }

  void persistThread(thread);
  render();
}

function handleThreadStageChange(event) {
  const stageContext = getStageContext(event.target, 'select[data-action="select-model"]');
  if (!stageContext) {
    return;
  }
  const { control, thread } = stageContext;
  thread.selectedModel = getValidSelectedModel(control.value);
  thread.updatedAt = nowIso();
  void persistThread(thread);
  render();
}

function handleThreadStageSubmit(event) {
  const stageContext = getStageContext(event.target, 'form[data-action="send-message"]');
  if (!stageContext) {
    return;
  }
  event.preventDefault();
  const { control: form, thread } = stageContext;

  const input = form.querySelector('[data-role="composer-input"]');
  const content = typeof input?.value === "string" ? input.value.trim() : "";
  if (!content) {
    return;
  }

  thread.messages.push({
    id: makeId(),
    role: "user",
    content,
    createdAt: nowIso(),
  });
  thread.updatedAt = nowIso();
  thread.isOpen = true;
  state.activeThreadId = thread.id;

  if (input) {
    input.value = "";
    input.disabled = true;  // Prevent duplicate sends while persisting
  }

  render();

  // Ensure persistence completes before re-enabling input
  persistThread(thread).then(() => {
    if (input) {
      input.disabled = false;
    }
  }).catch((error) => {
    // On error, restore input value so user doesn't lose their message
    if (input) {
      input.value = content;
      input.disabled = false;
    }
    console.error("Failed to save message:", error);
  });
}

async function removeThread(threadId) {
  if (typeof threadId !== "string" || !threadId) {
    return;
  }

  const beforeLength = state.threads.length;
  state.threads = state.threads.filter((thread) => thread.id !== threadId);

  if (state.threads.length === beforeLength) {
    return;
  }

  if (state.activeThreadId === threadId) {
    state.activeThreadId = state.threads.find((thread) => thread.isOpen)?.id || null;
  }

  render();

  if (!state.db) {
    return;
  }

  try {
    await deleteThreadWithMessages(state.db, threadId);
  } catch (error) {
    // If DB delete fails, restore thread to state to maintain consistency
    state.threads = [{ id: threadId }, ...state.threads].sort(
      (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)
    );
    render();
  }
}

function getThreadById(threadId) {
  if (typeof threadId !== "string") {
    return null;
  }

  return state.threads.find((thread) => thread.id === threadId) || null;
}

function persistThread(thread) {
  if (!state.db || !shouldPersistThread(thread)) {
    return Promise.resolve();
  }

  return upsertThreadWithMessages(state.db, thread).catch((error) => {
    console.error("Failed to persist thread:", error);
    throw error;
  });
}

function getStageContext(eventTarget, selector) {
  const control = getClosestEventTarget(eventTarget, selector);
  if (!control) {
    return null;
  }

  const panel = control.closest(".thread-panel");
  if (!panel) {
    return null;
  }

  const thread = getThreadById(panel.dataset.threadId);
  return thread ? { control, thread } : null;
}

function handleCloseConfig() {
  if (elements.configDialog) {
    elements.configDialog.close();
  }
}

function openThreadConfig(thread) {
  if (!elements.configDialog || !elements.configIframe) {
    return;
  }

  const selectedModel = getValidSelectedModel(thread.selectedModel);
  const configUrl = `../llm-config/index.html?thread=${encodeURIComponent(
    thread.id
  )}&selected=${encodeURIComponent(selectedModel)}`;

  elements.configIframe.src = configUrl;

  if (!elements.configDialog.open) {
    elements.configDialog.showModal();
  }
}

function pickExistingThreadId(candidateId) {
  if (
    typeof candidateId === "string" &&
    candidateId &&
    state.threads.some((thread) => thread.id === candidateId)
  ) {
    return candidateId;
  }

  return state.threads.find((thread) => thread.isOpen)?.id || null;
}

function getValidSelectedModel(candidate) {
  if (!state.availableModels.length) {
    return "";
  }

  if (
    typeof candidate === "string" &&
    state.availableModels.some((option) => option.value === candidate)
  ) {
    return candidate;
  }

  return state.availableModels[0].value;
}