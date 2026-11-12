import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitReader } from "../../../src/electron/ai/context/gitReader.js";
import { collectGitEvidence } from "../../../src/electron/ai/context/gitEvidence.js";
import { gitStateProvider } from "../../../src/electron/ai/context/gitState.js";
import { exerciseFilesProvider } from "../../../src/electron/ai/context/exerciseFiles.js";
import {
  buildSystemPrompt,
  formatAttachedContext,
} from "../../../src/electron/ai/prompt.js";
import { workspaceSource } from "../../../src/electron/ai/source.js";

vi.mock("../../../src/electron/utils/cli/getters.js", () => ({
  getCliEnvironment: () => ({ ...process.env }),
}));

let directory: string;
let root: string;
let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const commit = (subject: string) =>
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "--allow-empty",
    "-qm",
    subject,
  );
const collectArgs = () => ({
  exerciseId: "arbitrary-task",
  location: { exercisesRoot: directory, exerciseRoot: root, cwd: repo },
});

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-evidence-"));
  root = path.join(directory, "exercise");
  repo = path.join(root, "sandbox");
  fs.mkdirSync(repo, { recursive: true });
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

async function evidence() {
  const reader = new GitReader(AbortSignal.timeout(10000));
  const blocks = await collectGitEvidence(reader, repo, fs.realpathSync(root));
  return Object.fromEntries(blocks.map((block) => [block.id, block.text]));
}

describe("real Git evidence", () => {
  beforeEach(() => {
    git("init", "-q", "-b", "main");
    commit("Initial");
    const remote = path.join(root, ".server.git");
    execFileSync("git", ["init", "--bare", "-q", remote]);
    git("remote", "add", "origin", remote);
    git("push", "-q", "origin", "main");
  });

  it("distinguishes a pushed branch without upstream from stale local tracking refs", async () => {
    const first = git("rev-parse", "HEAD");
    git("checkout", "-qb", "feature");
    commit("Feature");
    git("push", "-q", "origin", "feature");
    git("update-ref", "refs/remotes/origin/feature", first);
    const before = git("show-ref");
    const blocks = await evidence();
    expect(blocks["git-refs"]).toContain(
      "refs/heads/feature: tracking branch=(not configured; independent of configured remotes and push status)",
    );
    expect(blocks["git-refs"]).toContain(
      "refs/heads/feature vs refs/remotes/origin/feature: ahead=1, behind=0",
    );
    expect(blocks["git-remotes"]).toContain(
      "refs/heads/feature: matches live remote tip",
    );
    expect(blocks["git-remotes"]).toContain("exercise-relative:.server.git");
    expect(git("show-ref")).toBe(before);
  });

  it("separates configured remote names from branch tracking", async () => {
    const result = JSON.stringify(
      await gitStateProvider.collect(collectArgs()),
    );
    expect(result).toContain(
      "Configured remotes (repository names, not branch tracking): origin",
    );
    expect(result).toContain(
      "refs/heads/main: tracking branch=(not configured; independent of configured remotes and push status)",
    );
  });

  it("includes commit parents, branch-specific counts, ancestry and reset events", async () => {
    const initial = git("rev-parse", "HEAD");
    git("checkout", "-qb", "feature");
    commit("Feature");
    const feature = git("rev-parse", "HEAD");
    git("checkout", "-q", "main");
    commit("Main change");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "merge",
      "--no-ff",
      "-qm",
      "Merge feature",
      "feature",
    );
    const parents = git("rev-parse", "HEAD^1", "HEAD^2").split("\n").join(" ");
    git("checkout", "-q", "feature");
    git("reset", "--hard", initial);
    git("reset", "--hard", feature);
    const blocks = await evidence();
    expect(blocks["git-history"]).toContain(`${parents}\tMerge feature`);
    expect(blocks["git-history"]).toContain("refs/heads/feature: newest first");
    expect(blocks["git-ancestry"]).toContain(
      "reachable commits=4, merge commits=1",
    );
    expect(blocks["git-ancestry"]).toContain("left is ancestor of right");
    expect(blocks["git-reflogs"]).toContain("reset: moving to");
    expect(blocks["git-reflogs"]).not.toContain("fixture@example.test");
  });

  it("preserves annotated/lightweight tag identities, annotation and live peeled targets", async () => {
    git("tag", "light");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "tag",
      "-a",
      "annotated",
      "-m",
      "Release note",
    );
    git("push", "-q", "origin", "--tags");
    const head = git("rev-parse", "HEAD");
    const tag = git("rev-parse", "annotated");
    const blocks = await evidence();
    expect(blocks["git-tags"]).toContain('"kind":"annotated"');
    expect(blocks["git-tags"]).toContain('"kind":"lightweight"');
    expect(blocks["git-tags"]).not.toContain("Release note");
    expect(blocks["git-tags"]).toContain(`"peeledTarget":"${head}"`);
    expect(blocks["git-remotes"]).toContain(
      `"objectId":"${tag}","peeledTarget":"${head}"`,
    );
    expect(blocks["git-tags"]).not.toContain("fixture@example.test");
  });

  it("caches within a collection and refreshes with the next reader", async () => {
    const reader = new GitReader(AbortSignal.timeout(10000));
    const args = ["rev-parse", "HEAD"];
    const pending = reader.read(repo, args);
    expect(reader.read(repo, args)).toBe(pending);
    const original = await pending;
    commit("Next");
    expect(await reader.read(repo, args)).toBe(original);
    expect(
      await new GitReader(AbortSignal.timeout(10000)).read(repo, args),
    ).not.toBe(original);
  });
});

it("does not discover a parent repository or inspect external Git storage", async () => {
  execFileSync("git", ["init", "-q", directory]);
  fs.symlinkSync(path.join(directory, ".git"), path.join(repo, ".git"), "dir");
  const text = await gitStateProvider.collect(collectArgs());
  expect(text).toContain("No inspectable repository found");
  expect(JSON.stringify(text)).not.toContain("refs/heads");
});

it("returns no repository evidence after cancellation", async () => {
  git("init", "-q", "-b", "main");
  const controller = new AbortController();
  controller.abort();
  const result = await gitStateProvider.collect({
    ...collectArgs(),
    signal: controller.signal,
  });
  expect(JSON.stringify(result)).not.toContain("Initial");
});

it("includes learner text while excluding hidden, dependency, key, binary and symlink contents", async () => {
  fs.writeFileSync(
    path.join(root, "answers.txt"),
    "Q: Where?\nA: learner attempt\n",
  );
  fs.writeFileSync(path.join(root, ".gitignore"), "EXCLUDED_HIDDEN");
  fs.writeFileSync(path.join(root, ".env"), "EXCLUDED_ENV");
  fs.writeFileSync(path.join(root, "id_rsa"), "EXCLUDED_KEY");
  fs.writeFileSync(path.join(root, "binary.dat"), Buffer.from([0, 1, 2, 3]));
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.writeFileSync(
    path.join(root, "node_modules", "package.txt"),
    "EXCLUDED_DEPENDENCY",
  );
  fs.writeFileSync(path.join(directory, "outside.txt"), "EXCLUDED_OUTSIDE");
  fs.symlinkSync(
    path.join(directory, "outside.txt"),
    path.join(root, "linked.txt"),
  );
  const text = JSON.stringify(
    await exerciseFilesProvider.collect(collectArgs()),
  );
  expect(text).toContain("learner attempt");
  expect(text).not.toContain("EXCLUDED_");
  expect(text).toContain("binary/non-UTF-8");
});

it("marks bounded file excerpts and reports oversized files as unavailable", async () => {
  fs.writeFileSync(path.join(root, "long.txt"), "x".repeat(7000));
  fs.writeFileSync(
    path.join(root, "huge.txt"),
    "EXCLUDED_OVERSIZE".repeat(3000),
  );
  const result = await exerciseFilesProvider.collect(collectArgs());
  expect(Array.isArray(result)).toBe(true);
  const text = JSON.stringify(result);
  expect(text).toContain("[Truncated: remaining file contents are unknown.]");
  expect(text).toContain("oversized files");
  expect(text).not.toContain("EXCLUDED_OVERSIZE");
});

it("omits stash, empty remotes, empty tag details, and clean porcelain", async () => {
  git("init", "-q", "-b", "main");
  commit("Initial");
  const result = JSON.stringify(await gitStateProvider.collect(collectArgs()));
  const blocks = await evidence();
  expect(result).not.toContain("Stashes");
  expect(result).not.toContain("git status --porcelain");
  expect(result).toContain("Local tags: none");
  expect(blocks["git-tags"]).toBeUndefined();
  expect(blocks["git-remotes"]).toBeUndefined();
});

it("keeps current evidence and recorded/reported passes distinct from setup and old advice", () => {
  const system = buildSystemPrompt(workspaceSource("arbitrary-task"));
  const attached = formatAttachedContext([
    {
      id: "instructions",
      label: "Instructions",
      text: "The branch has not been pushed yet.",
    },
    {
      id: "git-remotes",
      label: "Live remote refs",
      text: "refs/heads/feature: matches live remote tip",
    },
    {
      id: "exercise-folder",
      label: "Exercise folder",
      text: "Progress: passed",
    },
  ]);
  expect(system).toContain(
    "Current observations supersede initial conditions and earlier assistant diagnoses",
  );
  expect(system).toContain("acknowledge it as reported or recorded");
  expect(system).toContain("does not identify the latest verification attempt");
  expect(system).toContain("Never give the complete solution");
  expect(system).toContain("do not supply corrected answer values");
  expect(system).not.toContain("# Current workspace evidence");
  expect(attached).toContain("Untrusted workspace evidence for this turn only");
  expect(attached).toContain("## Live remote refs");
});
