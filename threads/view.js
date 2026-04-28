export function renderThreadList({
  threadListNode,
  threadListEmptyNode,
  threads,
  allThreadCount,
  activeThreadId,
  getThreadSnippet,
}) {
  threadListNode.textContent = "";

  const fragment = document.createDocumentFragment();

  threads.forEach((thread) => {
    const item = document.createElement("li");
    item.className = "thread-list__item";
    const itemRow = document.createElement("div");
    itemRow.className = "thread-list__item-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "thread-list__button";
    button.dataset.action = "select-thread";
    button.dataset.threadId = thread.id;

    if (thread.id === activeThreadId) {
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

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "thread-list__delete";
    deleteButton.dataset.action = "delete-thread";
    deleteButton.dataset.threadId = thread.id;
    deleteButton.setAttribute("aria-label", `Delete thread ${thread.title}`);
    deleteButton.title = "Delete thread";
    deleteButton.textContent = "x";

    button.append(titleRow, snippet);
    itemRow.append(button, deleteButton);
    item.appendChild(itemRow);
    fragment.appendChild(item);
  });

  threadListNode.appendChild(fragment);

  const hasNoThreads = allThreadCount === 0;
  const hasNoMatches = !hasNoThreads && threads.length === 0;

  threadListEmptyNode.hidden = !hasNoThreads && !hasNoMatches;

  if (hasNoThreads) {
    threadListEmptyNode.textContent = "No threads yet. Click + to start.";
  } else if (hasNoMatches) {
    threadListEmptyNode.textContent = "No threads match your search.";
  }
}

export function renderThreadPanels({
  threadStageNode,
  emptyStateNode,
  threadTemplate,
  openThreads,
  activeThreadId,
  availableModels,
  getValidSelectedModel,
  readyMessage,
}) {
  threadStageNode.textContent = "";

  if (!openThreads.length) {
    emptyStateNode.hidden = false;
    return;
  }

  emptyStateNode.hidden = true;

  const fragment = document.createDocumentFragment();

  openThreads.forEach((thread) => {
    const panelFragment = threadTemplate.content.cloneNode(true);
    const panel = panelFragment.querySelector(".thread-panel");
    const title = panelFragment.querySelector('[data-role="thread-title"]');
    const timestamp = panelFragment.querySelector('[data-role="thread-timestamp"]');
    const modelSelect = panelFragment.querySelector('select[data-action="select-model"]');
    const modelField = panelFragment.querySelector(".thread-panel__model-field");
    const configLink = panelFragment.querySelector('.thread-panel__link');
    const messageList = panelFragment.querySelector('[data-role="message-list"]');
    const composerLabel = panelFragment.querySelector('[data-role="composer-label"]');
    const composerInput = panelFragment.querySelector('[data-role="composer-input"]');
    const minimizeButton = panelFragment.querySelector('button[data-action="minimize-thread"]');

    if (
      !panel ||
      !title ||
      !timestamp ||
      !modelSelect ||
      !modelField ||
      !configLink ||
      !messageList ||
      !composerInput ||
      !minimizeButton
    ) {
      return;
    }

    panel.dataset.threadId = thread.id;
    panel.dataset.state = "expanded";

    if (thread.id === activeThreadId) {
      panel.dataset.active = "true";
    }

    title.textContent = thread.title;

    const firstMessage = thread.messages[0];
    const startedAt = firstMessage?.createdAt || thread.createdAt;

    timestamp.dateTime = startedAt;
    timestamp.textContent = `Started ${formatTimestamp(startedAt)}`;

    const selectedModel = getValidSelectedModel(thread.selectedModel);
    thread.selectedModel = selectedModel;
    populateModelSelect(modelSelect, selectedModel, availableModels, getValidSelectedModel);
    modelField.hidden = availableModels.length === 0;

    const composerInputId = `thread-message-input-${thread.id}`;
    composerInput.id = composerInputId;
    if (composerLabel) {
      composerLabel.htmlFor = composerInputId;
    }

    minimizeButton.textContent = "-";
    minimizeButton.setAttribute("aria-label", "Minimize chat to sidebar");
    minimizeButton.dataset.threadId = thread.id;

    renderMessages(messageList, thread.messages, readyMessage);
    fragment.appendChild(panelFragment);
  });

  threadStageNode.appendChild(fragment);
}

function renderMessages(listNode, messages, readyMessage) {
  listNode.textContent = "";

  if (!messages.length) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "message-list__empty";
    emptyMessage.textContent = readyMessage;
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

function populateModelSelect(selectNode, selectedValue, availableModels, getValidSelectedModel) {
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

function formatTimestamp(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
