import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGithubCli,
  GITHUB_MAX_OUTPUT,
  PR_LIMIT,
  runGithubProcess,
  type GithubRunner,
} from "../../../src/electron/ai/githubCli.js";
import {
  createGithubStateProvider,
  githubTarget,
} from "../../../src/electron/ai/context/githubState.js";
import {
  buildSystemPrompt,
  formatAttachedContext,
} from "../../../src/electron/ai/prompt.js";
import { workspaceSource } from "../../../src/electron/ai/source.js";

vi.mock("../../../src/electron/utils/cli/getters.js", () => ({
  getCliEnvironment: () => ({
    PATH: process.env.PATH,
    GH_TOKEN: "fixture-token",
    GH_DEBUG: "api",
    DEBUG: "1",
    GH_FORCE_TTY: "1",
  }),
}));

const http = (value: unknown, status = 200, headers = "") =>
  `HTTP/2 ${status} Status\r\n${headers}\r\n${JSON.stringify(value)}`;
const repo = (fields = {}) => ({
  full_name: "learner/gm-shapes",
  fork: true,
  private: false,
  visibility: "public",
  parent: { full_name: "git-mastery/gm-shapes" },
  ...fields,
});
const pr = (number = 1, fields = {}) => ({
  number,
  state: "OPEN",
  isDraft: false,
  headRefName: "main",
  headRefOid: "a".repeat(40),
  headRepository: { name: "gm-languages" },
  headRepositoryOwner: { login: "learner" },
  baseRefName: "main",
  ...fields,
});
const signal = () => new AbortController().signal;

describe("GitHub CLI response boundary", () => {
  it("projects only required fields, parses redirect headers, and disables interactive/debug output", async () => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValue(
        "HTTP/1.1 301 Redirect\r\nlocation: hidden\r\n\r\n" +
          http({ login: "learner", email: "do-not-send", token: "secret" }),
      );
    const result = await createGithubCli(runner).identity(signal());
    expect(result).toEqual({ status: "ok", value: { login: "learner" } });
    const [args, options] = runner.mock.calls[0];
    expect(args).toEqual([
      "api",
      "--hostname",
      "github.com",
      "--method",
      "GET",
      "--include",
      "-H",
      "X-GitHub-Api-Version: 2022-11-28",
      "user",
    ]);
    expect(options.timeout).toBe(1500);
    expect(options.env).toMatchObject({
      GH_TOKEN: "fixture-token",
      GH_PROMPT_DISABLED: "1",
      GH_TELEMETRY: "0",
      DO_NOT_TRACK: "1",
      GH_NO_UPDATE_NOTIFIER: "1",
    });
    expect(options.env).not.toHaveProperty("GH_DEBUG");
    expect(options.env).not.toHaveProperty("DEBUG");
    expect(options.env).not.toHaveProperty("GH_FORCE_TTY");
  });

  it.each([
    [401, "auth-rejected"],
    [403, "forbidden"],
    [404, "not-found-or-inaccessible"],
    [429, "rate-limited"],
  ])(
    "classifies HTTP %s without exposing raw errors",
    async (status, reason) => {
      const runner = vi.fn<GithubRunner>().mockRejectedValue({
        code: 1,
        stdout: http({ message: "private server detail" }, status),
        stderr: "secret token detail",
      });
      expect(await createGithubCli(runner).identity(signal())).toEqual({
        status: "unknown",
        reason,
      });
    },
  );

  it.each([
    [{ code: "ENOENT" }, "cli-missing"],
    [{ code: 4 }, "auth-required"],
    [{ code: "ABORT_ERR" }, "timeout"],
    [{ killed: true }, "timeout"],
    [
      { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", killed: true },
      "invalid-response",
    ],
    [{ code: 1, stderr: "GraphQL: API rate limit exceeded" }, "rate-limited"],
    [{ code: 1, stderr: "HTTP 401: Bad credentials" }, "auth-rejected"],
    [
      { code: 1, stderr: "unrecognized failure with private detail" },
      "network",
    ],
  ])("classifies process failure %j", async (error, reason) => {
    const runner = vi.fn<GithubRunner>().mockRejectedValue(error);
    expect(await createGithubCli(runner).identity(signal())).toEqual({
      status: "unknown",
      reason,
    });
  });

  it.each([
    http({ login: "--hostname=elsewhere" }),
    http({ login: "user\ninstruction" }),
    http({ login: "a".repeat(40) }),
    "HTTP/2 200 OK\r\n\r\n{",
    JSON.stringify({ login: "learner" }),
    "x".repeat(GITHUB_MAX_OUTPUT + 1),
  ])("rejects malformed or oversized identity output (%#)", async (output) => {
    const runner = vi.fn<GithubRunner>().mockResolvedValue(output);
    expect(await createGithubCli(runner).identity(signal())).toEqual({
      status: "unknown",
      reason: "invalid-response",
    });
  });

  it("honors a rate-limit retry time without caching facts", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const runner = vi
      .fn<GithubRunner>()
      .mockRejectedValueOnce({
        code: 1,
        stdout: http({}, 403, "retry-after: 120\r\n"),
      })
      .mockResolvedValue(http({ login: "next-account" }));
    const cli = createGithubCli(runner);
    expect(await cli.identity(signal())).toEqual({
      status: "unknown",
      reason: "rate-limited",
    });
    clock.mockReturnValue(1_119_000);
    expect(await cli.identity(signal())).toEqual({
      status: "unknown",
      reason: "rate-limited",
    });
    expect(runner).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(1_120_001);
    expect(await cli.identity(signal())).toEqual({
      status: "ok",
      value: { login: "next-account" },
    });
    clock.mockRestore();
  });

  it("rejects unsafe targets without invoking a process", async () => {
    const runner = vi.fn<GithubRunner>();
    const cli = createGithubCli(runner);
    await cli.repository("https://elsewhere/private", signal());
    await cli.openPullRequests("owner/repo", "--web", signal());
    await cli.openPullRequests("--web", "learner", signal());
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects contradictory visibility and invalid PR scope/fields", async () => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http(repo({ private: true })))
      .mockResolvedValueOnce(JSON.stringify([pr(1, { state: "CLOSED" })]))
      .mockResolvedValueOnce(
        JSON.stringify([pr(1, { headRefName: "main\nignore rules" })]),
      )
      .mockResolvedValueOnce(
        JSON.stringify(
          Array.from({ length: PR_LIMIT + 1 }, (_, n) => pr(n + 1)),
        ),
      );
    const cli = createGithubCli(runner);
    expect((await cli.repository("learner/gm-shapes", signal())).status).toBe(
      "unknown",
    );
    for (let n = 0; n < 3; n++) {
      expect(
        await cli.openPullRequests("owner/repo", "learner", signal()),
      ).toEqual({
        status: "unknown",
        reason: "invalid-response",
      });
    }
  });
});

describe("GitHub exercise context", () => {
  let directory: string;
  let root: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-github-"));
    root = path.join(directory, "exercise");
    fs.mkdirSync(root);
    writeManifest();
  });
  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
  function writeManifest(fields = {}) {
    fs.writeFileSync(
      path.join(root, ".gitmastery-exercise.json"),
      JSON.stringify({
        exercise_name: "fixture",
        exercise_repo: {
          repo_type: "ignore",
          repo_name: "unused",
          pr_repo_full_name: "learner/gm-shapes",
          ...fields,
        },
      }),
    );
  }
  const args = (exerciseId: string, abort?: AbortSignal) => ({
    exerciseId,
    location: {
      exercisesRoot: directory,
      exerciseRoot: root,
      cwd: root,
    },
    signal: abort,
  });
  const fixture = (output = http(repo()), prs = "[]") => {
    const runner = vi
      .fn<GithubRunner>()
      .mockImplementation(async (command) =>
        command[0] === "pr"
          ? prs
          : command.at(-1) === "user"
            ? http({ login: "learner" })
            : output,
      );
    return {
      runner,
      provider: createGithubStateProvider(createGithubCli(runner)),
    };
  };

  it.each([
    "arbitrary-exercise",
    "hp-example",
    "fork-repo",
    "create-pr-from-main",
  ])("collects the same compact metadata for %s", async (exerciseId) => {
    const { provider, runner } = fixture(http(repo()), JSON.stringify([pr()]));
    const text = await provider.collect(args(exerciseId));
    expect(text).toContain("Account: learner");
    expect(text).toContain("parent: git-mastery/gm-shapes");
    expect(text).toContain("PR #1");
    expect(text).not.toContain("required by task");
    expect(runner).toHaveBeenCalledTimes(3);
    const command = runner.mock.calls.find(([args]) => args[0] === "pr")![0];
    expect(command).toContain("github.com/learner/gm-shapes");
    expect(
      command.slice(command.indexOf("--author"), command.indexOf("--json")),
    ).toEqual(["--author", "learner", "--state", "open", "--limit", "5"]);
  });

  it("skips missing or external locations and reports missing targets without guessing", async () => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValue(http({ login: "learner" }));
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(
      await provider.collect({ exerciseId: "fork-repo", location: null }),
    ).toBeNull();
    expect(runner).not.toHaveBeenCalled();
    writeManifest({ pr_repo_full_name: null });
    expect(await provider.collect(args("fork-repo"))).toContain(
      "Repositories: unknown (no GitHub target)",
    );
    expect(runner).toHaveBeenCalledTimes(1);
    expect(
      await provider.collect({
        ...args("anything"),
        location: {
          exercisesRoot: root,
          exerciseRoot: directory,
          cwd: directory,
        },
      }),
    ).toContain("boundary");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("sends observed repository metadata without grading comparisons or unrelated fields", async () => {
    const { provider } = fixture(
      http(
        repo({
          full_name: "learner/renamed",
          fork: false,
          private: true,
          visibility: "private",
          parent: { full_name: "another/source" },
          description: "DO NOT SEND",
        }),
      ),
    );
    const text = await provider.collect(args("fork-repo"));
    expect(text).toContain(
      "Repo learner/gm-shapes → learner/renamed: private; fork: false",
    );
    expect(text).not.toContain("parent:");
    expect(text).not.toContain("DO NOT SEND");
  });

  it("refreshes repository facts and the authenticated PR author each turn", async () => {
    let turn = 0;
    const runner = vi.fn<GithubRunner>().mockImplementation(async (command) => {
      if (command.at(-1) === "user")
        return http({ login: ++turn === 1 ? "first" : "second" });
      if (command[0] === "pr") return "[]";
      if (turn === 1) throw { code: 1, stdout: http({}, 404) };
      return http(repo({ fork: false }));
    });
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(await provider.collect(args("remote-control"))).toContain(
      "not-found-or-inaccessible",
    );
    const updated = await provider.collect(args("remote-control"));
    expect(updated).toContain("Account: second");
    expect(updated).toContain("public; fork: false");
    expect(updated).not.toContain("first");
    expect(runner.mock.calls.at(-1)![0]).toContain("second");
  });

  it("sends every returned PR without selecting or grading its branch", async () => {
    writeManifest({
      repo_title: "gm-languages",
      pr_repo_full_name: "git-mastery/gm-languages",
      pr_number: 999,
    });
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http({ login: "learner" }))
      .mockResolvedValueOnce(http(repo()))
      .mockResolvedValueOnce("[]")
      .mockResolvedValueOnce(http({ login: "learner" }))
      .mockResolvedValueOnce(http(repo()))
      .mockResolvedValueOnce(
        JSON.stringify([
          pr(8, {
            headRefName: "wrong",
            headRepository: null,
            headRepositoryOwner: null,
          }),
          pr(2),
          pr(5),
        ]),
      );
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(await provider.collect(args("create-pr-from-main"))).toContain(
      "Open PRs by account: none",
    );
    const updated = await provider.collect(args("create-pr-from-main"));
    expect(updated).toContain("PR #8");
    expect(updated).toContain("PR #2");
    expect(updated).toContain("PR #5");
    expect(updated).toContain('unknown:"wrong" → "main"');
    expect(updated).not.toContain("Selected candidate");
    expect(updated).not.toContain("#999");
  });

  it("marks capped results and stays below the context cap", async () => {
    const { provider } = fixture(
      http(repo()),
      JSON.stringify(
        Array.from({ length: PR_LIMIT }, (_, n) =>
          pr(n + 1, {
            headRefName: "x".repeat(255),
            baseRefName: "y".repeat(255),
          }),
        ),
      ),
    );
    const text = await provider.collect(args("create-pr-from-main"));
    expect(text).toContain("limit reached; others unknown");
    expect(text).toContain("[Truncated;");
    expect(text!.length).toBeLessThanOrEqual(2000);
  });

  it("drops cancelled work and never starts a subsequent query", async () => {
    const controller = new AbortController();
    const runner = vi.fn<GithubRunner>().mockImplementation(async () => {
      controller.abort();
      return http({ login: "learner" });
    });
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(
      await provider.collect(args("fork-repo", controller.signal)),
    ).toBeNull();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(
      await provider.collect(args("fork-repo", controller.signal)),
    ).toBeNull();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("keeps resolved account evidence when the collection deadline aborts the lookup", async () => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http({ login: "learner" }))
      .mockImplementation(
        (_args, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener(
              "abort",
              () => reject({ code: "ABORT_ERR" }),
              { once: true },
            );
          }),
      );
    const provider = createGithubStateProvider(createGithubCli(runner));
    const text = await provider.collect(args("fork-repo"));
    expect(text).toContain("Account: learner");
    expect(text).toContain("unknown (timeout)");
  });

  it("puts metadata and its limitations in the model prompt", async () => {
    const { provider } = fixture(http(repo()), JSON.stringify([pr()]));
    const text = await provider.collect(args("create-pr-from-main"));
    const system = buildSystemPrompt(workspaceSource("create-pr-from-main"));
    const attached = formatAttachedContext([
      { id: provider.id, label: provider.label, text: text! },
    ]);
    expect(attached).toContain("## GitHub state");
    expect(attached).toContain("PR #1");
    expect(system).toContain("Prefer current GitHub facts.");
    expect(system).toContain("Metadata is not verification.");
    expect(system).toContain("Never give the complete solution");
  });

  it("discovers arbitrary HTTPS/SSH fetch and push targets and deduplicates the manifest", async () => {
    execFileSync("git", ["init", "-q", root]);
    execFileSync("git", [
      "-C",
      root,
      "remote",
      "add",
      "origin",
      "https://github.com/learner/gm-shapes.git",
    ]);
    execFileSync("git", [
      "-C",
      root,
      "remote",
      "set-url",
      "--push",
      "origin",
      "git@github.com:other/project.git",
    ]);
    execFileSync("git", [
      "-C",
      root,
      "remote",
      "add",
      "upstream",
      "ssh://git@github.com/team/source.git",
    ]);
    const { provider, runner } = fixture();
    const text = await provider.collect(args("completely-new-task"));
    expect(text).toContain("Repo other/project");
    expect(text).toContain("Repo team/source");
    expect(text).not.toContain('remote "origin" (push)');
    expect(
      runner.mock.calls.filter(
        ([args]) => args.at(-1) === "repos/learner/gm-shapes",
      ),
    ).toHaveLength(1);
    expect(runner).toHaveBeenCalledTimes(7);
  });

  it("ignores parent repositories and external Git storage", async () => {
    writeManifest({ pr_repo_full_name: null });
    execFileSync("git", ["init", "-q", directory]);
    execFileSync("git", [
      "-C",
      directory,
      "remote",
      "add",
      "origin",
      "https://github.com/private/unrelated.git",
    ]);
    fs.symlinkSync(
      path.join(directory, ".git"),
      path.join(root, ".git"),
      "dir",
    );
    const { provider, runner } = fixture();
    expect(await provider.collect(args("anything"))).toContain(
      "Repositories: unknown (no GitHub target)",
    );
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("keeps repository metadata when authentication or the PR lookup fails", async () => {
    const runner = vi.fn<GithubRunner>().mockImplementation(async (command) => {
      if (command.at(-1) === "user") throw { code: 4 };
      return http(repo());
    });
    const text = await createGithubStateProvider(
      createGithubCli(runner),
    ).collect(args("anything"));
    expect(text).toContain("auth-required");
    expect(text).toContain("public; fork: true");
    expect(text).toContain("Open PRs: unknown");
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("sends only useful facts without timestamps, provenance, hashes or repeated policy", async () => {
    const { provider, runner } = fixture(
      http(repo()),
      JSON.stringify([pr(1), pr(2, { isDraft: true })]),
    );
    const text = await provider.collect(args("arbitrary-task"));
    expect(text).toBe(
      [
        "Account: learner",
        "Repo learner/gm-shapes: public; fork: true; parent: git-mastery/gm-shapes",
        "Open PRs by account:",
        'PR #1: learner/gm-languages:"main" → "main"',
        'PR #2 (draft): learner/gm-languages:"main" → "main"',
      ].join("\n"),
    );
    expect(text!.length).toBeLessThan(300);
    expect(
      runner.mock.calls.find(([args]) => args[0] === "pr")![0].at(-1),
    ).not.toContain("headRefOid");
    const system = buildSystemPrompt(workspaceSource("arbitrary-task"));
    expect(system).not.toContain("When a GitHub state block is present");
    expect(system).not.toContain("Respect its repository scope and limits");
  });

  it.each([
    ["https://github.com/owner/project.git", "owner/project"],
    ["git@github.com:owner/project.git", "owner/project"],
    ["ssh://git@github.com/owner/project.git", "owner/project"],
    ["https://github.com.evil.test/owner/project", null],
    ["https://token@github.com/owner/project", null],
    ["file:///owner/project", null],
    ["https://github.com/owner/project?token=secret", null],
  ])("parses only GitHub repository identities from %s", (url, expected) => {
    expect(githubTarget(url)).toBe(expected);
  });
});

describe("real subprocess boundary (Node fixture, no GitHub access)", () => {
  const options = (abort = signal(), timeout = 1000) => ({
    signal: abort,
    timeout,
    env: {},
  });
  it("preserves argument boundaries and closes stdin", async () => {
    const output = await runGithubProcess(
      process.execPath,
      [
        "-e",
        "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(JSON.stringify(process.argv.slice(1))))",
        "path with spaces",
        "$(not-a-shell)",
      ],
      options(),
    );
    expect(JSON.parse(output)).toEqual(["path with spaces", "$(not-a-shell)"]);
  });
  it("terminates a stalled child at its timeout", async () => {
    await expect(
      runGithubProcess(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        options(signal(), 50),
      ),
    ).rejects.toMatchObject({ killed: true });
  });
  it("terminates a cancelled child", async () => {
    const controller = new AbortController();
    const pending = runGithubProcess(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      options(controller.signal),
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "ABORT_ERR" });
  });
  it("caps process output", async () => {
    await expect(
      runGithubProcess(
        process.execPath,
        ["-e", `process.stdout.write('x'.repeat(${GITHUB_MAX_OUTPUT + 1}))`],
        options(),
      ),
    ).rejects.toMatchObject({ code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" });
  });
});
