import fs from "fs";
import path from "path";
import { getUserStoragePath } from "../storage.js";
import { parseAiSource } from "./source.js";

const HISTORY_VERSION = 1;
const HISTORY_NAME = "ai-history.json";
/** Keep in sync with `src/ui/ai/history.ts`. */
const MAX_STORED_MESSAGE_CHARS = 20_000;
const MAX_SESSION_BYTES = 256 * 1024;
const MAX_HISTORY_BYTES = 5 * 1024 * 1024;

function historyPath() {
  return path.join(getUserStoragePath(), HISTORY_NAME);
}

function emptyHistory(): StoredAiHistory {
  return { version: HISTORY_VERSION, sessions: {} };
}

/**
 * True after load sees a newer file version. Saves must not overwrite it.
 */
let refuseWrites = false;

let writeChain: Promise<void> = Promise.resolve();

function parseStoredMessage(value: unknown): StoredAiMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  if (record.role !== "user" && record.role !== "assistant") return null;
  if (typeof record.text !== "string") return null;
  const text =
    record.text.length <= MAX_STORED_MESSAGE_CHARS
      ? record.text
      : record.text.slice(0, MAX_STORED_MESSAGE_CHARS);
  return { id: record.id, role: record.role, text };
}

function dropOldestTurn(messages: StoredAiMessage[]) {
  if (messages.length === 0) return messages;
  if (messages[0].role === "user" && messages[1]?.role === "assistant") {
    return messages.slice(2);
  }
  return messages.slice(1);
}

function trimStoredSession(session: StoredAiSession): StoredAiSession {
  let next = session;
  while (
    next.messages.length > 1 &&
    JSON.stringify(next).length > MAX_SESSION_BYTES
  ) {
    next = { ...next, messages: dropOldestTurn(next.messages) };
  }
  return next;
}

function parseStoredSession(
  key: string,
  value: unknown,
): StoredAiSession | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const source = parseAiSource(record.source);
  if (!source || source.sourceKey !== key) return null;
  if (typeof record.conversationId !== "string" || !record.conversationId) {
    return null;
  }
  if (typeof record.updatedAt !== "string" || !record.updatedAt) return null;
  if (!Array.isArray(record.messages)) return null;
  const messages: StoredAiMessage[] = [];
  for (const item of record.messages) {
    const message = parseStoredMessage(item);
    if (!message) return null;
    messages.push(message);
  }
  return trimStoredSession({
    source,
    conversationId: record.conversationId,
    updatedAt: record.updatedAt,
    messages,
  });
}

function parseHistory(value: unknown): StoredAiHistory | "newer" | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.version !== "number") return null;
  if (record.version > HISTORY_VERSION) return "newer";
  if (record.version !== HISTORY_VERSION) return null;
  if (!record.sessions || typeof record.sessions !== "object") return null;
  const sessions: Record<string, StoredAiSession> = {};
  for (const [key, session] of Object.entries(
    record.sessions as Record<string, unknown>,
  )) {
    const parsed = parseStoredSession(key, session);
    if (!parsed) return null;
    sessions[key] = parsed;
  }
  return { version: HISTORY_VERSION, sessions };
}

function quarantineCorrupt(file: string) {
  const dest = path.join(
    path.dirname(file),
    `ai-history.corrupt-${Date.now()}.json`,
  );
  try {
    fs.renameSync(file, dest);
    console.warn("[ai] quarantined corrupt history at", dest);
  } catch (err) {
    console.error("[ai] failed to quarantine corrupt history:", err);
  }
}

export function loadAiHistory(): StoredAiHistory {
  refuseWrites = false;
  const file = historyPath();
  if (!fs.existsSync(file)) return emptyHistory();
  try {
    const parsed = parseHistory(JSON.parse(fs.readFileSync(file, "utf8")));
    if (parsed === "newer") {
      refuseWrites = true;
      console.warn("[ai] ignoring newer ai-history.json; leaving it untouched");
      return emptyHistory();
    }
    if (!parsed) {
      quarantineCorrupt(file);
      return emptyHistory();
    }
    return parsed;
  } catch {
    quarantineCorrupt(file);
    return emptyHistory();
  }
}

function sanitizeSessions(
  sessions: Record<string, StoredAiSession>,
): Record<string, StoredAiSession> | null {
  const next: Record<string, StoredAiSession> = {};
  for (const [key, session] of Object.entries(sessions)) {
    const parsed = parseStoredSession(key, session);
    if (!parsed) return null;
    if (parsed.messages.length === 0) continue;
    next[key] = trimStoredSession(parsed);
  }
  return next;
}

function historyJson(sessions: Record<string, StoredAiSession>) {
  const payload: StoredAiHistory = { version: HISTORY_VERSION, sessions };
  return JSON.stringify(payload, null, 2);
}

function writeAtomic(sessions: Record<string, StoredAiSession>) {
  const json = historyJson(sessions);
  if (json.length > MAX_HISTORY_BYTES) {
    console.warn("[ai] refusing to write oversized history");
    return false;
  }
  const file = historyPath();
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, json, "utf8");
  fs.renameSync(temp, file);
  return true;
}

export function saveAiHistory(
  sessions: Record<string, StoredAiSession>,
): Promise<boolean> {
  if (refuseWrites) return Promise.resolve(false);
  const sanitized = sanitizeSessions(sessions);
  if (!sanitized) return Promise.resolve(false);
  if (historyJson(sanitized).length > MAX_HISTORY_BYTES) {
    console.warn("[ai] refusing to write oversized history");
    return Promise.resolve(false);
  }

  const run = writeChain.then(
    () => {
      if (refuseWrites) return false;
      return writeAtomic(sanitized);
    },
    () => {
      if (refuseWrites) return false;
      return writeAtomic(sanitized);
    },
  );
  writeChain = run.then(
    () => undefined,
    (err) => {
      console.error("[ai] failed to write history:", err);
    },
  );
  return run.catch((err) => {
    console.error("[ai] failed to write history:", err);
    return false;
  });
}
