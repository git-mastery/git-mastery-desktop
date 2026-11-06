import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { collectContext } from "../../../src/electron/ai/context.js";
import { buildSystemPrompt } from "../../../src/electron/ai/prompt.js";
import { workspaceSource } from "../../../src/electron/ai/source.js";
import type { GithubRunner } from "../../../src/electron/ai/githubCli.js";

const fixture = vi.hoisted(() => ({
  directory: "",
  runner: vi.fn<GithubRunner>(),
}));
vi.mock("../../../src/electron/ai/githubCli.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/electron/ai/githubCli.js")
    >();
  return {
    ...actual,
    createGithubCli: () => actual.createGithubCli(fixture.runner),
  };
});
vi.mock("../../../src/electron/utils/cli/getters.js", () => ({
  getCliEnvironment: () => ({}),
}));
vi.mock("../../../src/electron/ai/availability.js", () => ({
  locateExercise: () => ({
    exercisesRoot: path.dirname(fixture.directory),
    exerciseRoot: fixture.directory,
    cwd: fixture.directory,
  }),
}));
vi.mock("../../../src/electron/ai/context/instructions.js", () => ({
  instructionsProvider: {
    id: "instructions",
    label: "Instructions",
    collect: async () => "Create a PR.",
  },
}));
vi.mock("../../../src/electron/ai/context/exerciseQuestions.js", () => ({
  exerciseQuestionsProvider: {
    id: "exercise-questions",
    label: "Questions",
    collect: async () => null,
  },
}));
vi.mock("../../../src/electron/ai/context/exerciseFolder.js", () => ({
  exerciseFolderProvider: {
    id: "exercise-folder",
    label: "Exercise folder",
    collect: async () => "Java.txt exists.",
  },
}));
vi.mock("../../../src/electron/ai/context/gitState.js", () => ({
  gitStateProvider: {
    id: "git-state",
    label: "Repository state",
    collect: async () => "Working tree clean.",
  },
}));

beforeEach(() => {
  fixture.runner.mockReset();
  fixture.directory = fs.mkdtempSync(path.join(os.tmpdir(), "github-wiring-"));
  fs.writeFileSync(
    path.join(fixture.directory, ".gitmastery-exercise.json"),
    JSON.stringify({
      exercise_name: "create-pr-from-main",
      exercise_repo: {
        repo_type: "ignore",
        repo_name: "unused",
        pr_repo_full_name: "team/project",
      },
    }),
  );
});
afterEach(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));

it("registers fresh GitHub metadata in successive context/prompt snapshots", async () => {
  const identity = 'HTTP/2 200 OK\r\n\r\n{"login":"learner"}';
  const repository =
    'HTTP/2 200 OK\r\n\r\n{"full_name":"team/project","fork":false,"private":false,"visibility":"public"}';
  fixture.runner
    .mockResolvedValueOnce(identity)
    .mockResolvedValueOnce(repository)
    .mockResolvedValueOnce("[]")
    .mockResolvedValueOnce(identity)
    .mockResolvedValueOnce(repository)
    .mockResolvedValueOnce(
      JSON.stringify([
        {
          number: 42,
          state: "OPEN",
          isDraft: false,
          headRefName: "main",
          headRefOid: "a".repeat(40),
          headRepository: { name: "gm-languages" },
          headRepositoryOwner: { login: "learner" },
          baseRefName: "main",
        },
      ]),
    );
  const source = workspaceSource("create-pr-from-main");
  const first = buildSystemPrompt(source, await collectContext(source.id));
  const blocks = await collectContext(source.id);
  const second = buildSystemPrompt(source, blocks);
  expect(first).toContain("Open PRs by account: none");
  expect(second).toContain("PR #42");
  expect(second).not.toContain("Open PRs by account: none");
  expect(second).toContain("Working tree clean.");
  expect(second).toContain("metadata is not verification");
  // These same blocks are emitted as data-context for the existing disclosure UI.
  expect(blocks.find((block) => block.id === "github-state")?.label).toBe(
    "GitHub state",
  );
  expect(fixture.runner).toHaveBeenCalledTimes(6);
});

it("keeps local context when GitHub authentication is unavailable", async () => {
  fixture.runner.mockRejectedValue({ code: 4, stderr: "private detail" });
  const blocks = await collectContext("create-pr-from-main");
  expect(blocks.find((block) => block.id === "github-state")?.text).toContain(
    "auth-required",
  );
  expect(blocks.find((block) => block.id === "git-state")?.text).toBe(
    "Working tree clean.",
  );
  expect(JSON.stringify(blocks)).not.toContain("private detail");
});

it("makes no GitHub calls for cancelled collection", async () => {
  const controller = new AbortController();
  controller.abort();
  expect(
    await collectContext("create-pr-from-main", controller.signal),
  ).toEqual([]);
  expect(fixture.runner).not.toHaveBeenCalled();
});
