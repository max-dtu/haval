export function shouldPersistThread(thread) {
  return Boolean(thread && Array.isArray(thread.messages) && thread.messages.length > 0);
}

export function createThreadSanitizer(getValidSelectedModel) {
  return function sanitizeThread(thread) {
    if (!thread || typeof thread !== "object") {
      return null;
    }

    const id = typeof thread.id === "string" && thread.id ? thread.id : null;
    if (!id) {
      return null;
    }

    const createdAt = isDateString(thread.createdAt) ? thread.createdAt : nowIso();
    const messages = Array.isArray(thread.messages)
      ? thread.messages.map(sanitizeMessage).filter(Boolean)
      : [];
    const updatedAt = isDateString(thread.updatedAt)
      ? thread.updatedAt
      : messages[messages.length - 1]?.createdAt || createdAt;

    return {
      id,
      title:
        typeof thread.title === "string" && thread.title.trim()
          ? thread.title
          : `Thread ${id.slice(0, 4)}`,
      createdAt,
      updatedAt,
      selectedModel: getValidSelectedModel(
        typeof thread.selectedModel === "string" ? thread.selectedModel : ""
      ),
      isOpen: Boolean(thread.isOpen),
      messages,
    };
  };
}

export function filterThreads(threads, query) {
  const normalizedQuery = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!normalizedQuery) {
    return threads;
  }

  return threads.filter((thread) => {
    const lastMessage = thread.messages[thread.messages.length - 1]?.content || "";
    return (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      lastMessage.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function getThreadSnippet(thread) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  return lastMessage?.content || "No messages yet.";
}

export function buildAvailableModels(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  const seen = new Set();
  const options = [];

  records.forEach((record) => {
    const valueCandidate =
      typeof record === "string"
        ? record
        : record && typeof record === "object"
          ? record.value || record.model || record.id || record.name
          : "";

    if (typeof valueCandidate !== "string" || !valueCandidate || seen.has(valueCandidate)) {
      return;
    }

    seen.add(valueCandidate);
    options.push({
      value: valueCandidate,
      label:
        record && typeof record === "object" && typeof record.label === "string"
          ? record.label
          : valueCandidate,
    });
  });

  return options;
}

export function getClosestEventTarget(eventTarget, selector) {
  if (eventTarget instanceof Element) {
    return eventTarget.closest(selector);
  }

  if (eventTarget instanceof Node && eventTarget.parentElement) {
    return eventTarget.parentElement.closest(selector);
  }

  return null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const role = message.role === "assistant" ? "assistant" : "user";
  const content = typeof message.content === "string" ? message.content : "";
  const createdAt = isDateString(message.createdAt) ? message.createdAt : nowIso();

  return {
    id: typeof message.id === "string" && message.id ? message.id : makeId(),
    role,
    content,
    createdAt,
  };
}

function isDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
