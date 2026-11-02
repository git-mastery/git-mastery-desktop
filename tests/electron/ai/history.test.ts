import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storagePath = vi.hoisted(() => ({ current: "" }));

vi.mock("../../../src/electron/storage.js", () => ({
  getUserStoragePath: () => storagePath.current,
}));

import {
  loadAiHistory,
  saveAiHistory,
} from "../../../src/electron/ai/history.js";

type StoredSessions = Parameters<typeof saveAiHistory>[0];
type StoredSession = StoredSessions[string];

const source: AiSource = {
  sourceKey: "exercise:commit-one-file",
  kind: "exercise",
  id: "commit-one-file",
  title: "Commit one file",
};

const validSession = (
  messages: StoredAiMessage[] = [
    { id: "user-1", role: "user", text: "Question" },
    { id: "assistant-1", role: "assistant", text: "Answer" },
  ],
): StoredSession => ({
  source,
  conversationId: "conversation-1",
  updatedAt: "2026-10-19T00:00:00.000Z",
  messages,
});

describe("AI history persistence", () => {
  let directory: string;
  let historyFile: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-history-"));
    storagePath.current = directory;
    historyFile = path.join(directory, "ai-history.json");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadAiHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const writeHistory = (value: unknown) => {
    fs.writeFileSync(historyFile, JSON.stringify(value), "utf8");
  };

  it("returns an empty history when no file exists", () => {
    expect(loadAiHistory()).toEqual({ version: 1, sessions: {} });
  });

  it("loads valid sessions and clips oversized messages", () => {
    writeHistory({
      version: 1,
      sessions: {
        [source.sourceKey]: validSession([
          { id: "user-1", role: "user", text: "x".repeat(20_050) },
        ]),
      },
    });

    const history = loadAiHistory();

    expect(history.sessions[source.sourceKey].messages[0].text).toHaveLength(
      20_000,
    );
  });

  it("quarantines a malformed or mismatched session", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    writeHistory({
      version: 1,
      sessions: {
        "exercise:different-key": validSession(),
      },
    });

    expect(loadAiHistory()).toEqual({ version: 1, sessions: {} });
    expect(fs.existsSync(historyFile)).toBe(false);
    expect(
      fs.existsSync(path.join(directory, "ai-history.corrupt-1234.json")),
    ).toBe(true);
  });

  it("leaves a newer history version untouched and refuses to overwrite it", async () => {
    const newerHistory = JSON.stringify({ version: 2, sessions: {} });
    fs.writeFileSync(historyFile, newerHistory, "utf8");

    expect(loadAiHistory()).toEqual({ version: 1, sessions: {} });
    await expect(
      saveAiHistory({ [source.sourceKey]: validSession() }),
    ).resolves.toBe(false);
    expect(fs.readFileSync(historyFile, "utf8")).toBe(newerHistory);
  });

  it("rejects invalid sessions without replacing the previous file", async () => {
    const previous = JSON.stringify({ previous: true });
    fs.writeFileSync(historyFile, previous, "utf8");
    const mismatched = {
      ...validSession(),
      source: { ...source, sourceKey: "exercise:different-key" },
    } as StoredSession;

    await expect(
      saveAiHistory({ [source.sourceKey]: mismatched }),
    ).resolves.toBe(false);
    expect(fs.readFileSync(historyFile, "utf8")).toBe(previous);
  });

  it("omits empty sessions when saving", async () => {
    await expect(
      saveAiHistory({
        [source.sourceKey]: validSession([]),
      }),
    ).resolves.toBe(true);

    expect(JSON.parse(fs.readFileSync(historyFile, "utf8"))).toEqual({
      version: 1,
      sessions: {},
    });
  });

  it("atomically replaces the history with a valid snapshot", async () => {
    await expect(
      saveAiHistory({
        [source.sourceKey]: validSession(),
      }),
    ).resolves.toBe(true);

    expect(JSON.parse(fs.readFileSync(historyFile, "utf8"))).toEqual({
      version: 1,
      sessions: {
        [source.sourceKey]: validSession(),
      },
    });
    expect(fs.readdirSync(directory)).toEqual(["ai-history.json"]);
  });
});
