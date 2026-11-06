import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGithubCli,
  GITHUB_MAX_OUTPUT,
  runGithubProcess,
  type GithubRunner,
} from "../../../src/electron/ai/githubCli.js";
import { createGithubStateProvider } from "../../../src/electron/ai/context/githubState.js";
import { buildSystemPrompt } from "../../../src/electron/ai/prompt.js";
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
    await cli.openPullRequests("--web", signal());
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
        JSON.stringify(Array.from({ length: 31 }, (_, n) => pr(n + 1))),
      );
    const cli = createGithubCli(runner);
    expect((await cli.repository("learner/gm-shapes", signal())).status).toBe(
      "unknown",
    );
    for (let n = 0; n < 3; n++) {
      expect(await cli.openPullRequests("learner", signal())).toEqual({
        status: "unknown",
        reason: "invalid-response",
      });
    }
  });
});

describe("GitHub exercise context", () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-github-"));
    writeManifest();
  });
  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
  function writeManifest(fields = {}) {
    fs.writeFileSync(
      path.join(directory, ".gitmastery-exercise.json"),
      JSON.stringify({
        exercise_name: "fixture",
        exercise_repo: { repo_type: "ignore", repo_name: "unused", ...fields },
      }),
    );
  }
  const args = (exerciseId: string, abort?: AbortSignal) => ({
    exerciseId,
    location: {
      exercisesRoot: directory,
      exerciseRoot: directory,
      cwd: directory,
    },
    signal: abort,
  });
  const fixture = (output: string) => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http({ login: "learner" }))
      .mockResolvedValueOnce(output);
    return {
      runner,
      provider: createGithubStateProvider(createGithubCli(runner)),
    };
  };

  it.each(["fork-repo", "clone-repo", "remote-control", "create-pr-from-main"])(
    "resolves %s without requiring a local repository",
    async (exerciseId) => {
      const { provider, runner } = fixture(
        exerciseId === "create-pr-from-main" ? "[]" : http(repo()),
      );
      const text = await provider.collect(args(exerciseId));
      expect(text).toContain("Authenticated GitHub account: learner");
      expect(runner).toHaveBeenCalledTimes(2);
      const command = runner.mock.calls[1][0];
      if (exerciseId === "create-pr-from-main") {
        expect(command).toContain("github.com/git-mastery/gm-languages");
        expect(
          command.slice(command.indexOf("--author"), command.indexOf("--json")),
        ).toEqual(["--author", "learner", "--state", "open", "--limit", "30"]);
        expect(text).toContain("committed Java.txt content");
      } else {
        expect(command.at(-1)).toBe(
          exerciseId === "remote-control"
            ? "repos/learner/gitmastery-learner-remote-control"
            : "repos/learner/gm-shapes",
        );
      }
    },
  );

  it("makes no requests for unsupported workspaces, missing locations, or conflicting setup", async () => {
    const runner = vi.fn<GithubRunner>();
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(await provider.collect(args("hp-example"))).toBeNull();
    expect(
      await provider.collect({ exerciseId: "fork-repo", location: null }),
    ).toBeNull();
    for (const fields of [
      { repo_title: "another-repo" },
      { pr_repo_full_name: "elsewhere/repo" },
      { pr_repo_full_name: 123 },
    ]) {
      writeManifest(fields);
      expect(await provider.collect(args("create-pr-from-main"))).toContain(
        "unsupported-target",
      );
    }
    expect(runner).not.toHaveBeenCalled();
  });

  it("reports observed mismatches and never projects unrelated repository content", async () => {
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
    expect(text).toContain("does not match");
    expect(text).toContain("Visibility: private; fork: false");
    expect(text).toContain("Direct parent: another/source");
    expect(text).not.toContain("DO NOT SEND");
  });

  it("refreshes unavailable then public metadata and resolves a changed account on the next turn", async () => {
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http({ login: "first" }))
      .mockRejectedValueOnce({ code: 1, stdout: http({}, 404) })
      .mockResolvedValueOnce(http({ login: "second" }))
      .mockResolvedValueOnce(
        http(
          repo({
            full_name: "second/gitmastery-second-remote-control",
            fork: false,
          }),
        ),
      );
    const provider = createGithubStateProvider(createGithubCli(runner));
    expect(await provider.collect(args("remote-control"))).toContain(
      "not-found-or-inaccessible",
    );
    const updated = await provider.collect(args("remote-control"));
    expect(updated).toContain("Authenticated GitHub account: second");
    expect(updated).toContain("Public visibility required by task: observed");
    expect(updated).toContain(
      "URL submitted to interactive verification is unknown",
    );
    expect(updated).not.toContain("first");
    expect(runner.mock.calls[3][0].at(-1)).toBe(
      "repos/second/gitmastery-second-remote-control",
    );
  });

  it("refreshes no PR to the highest returned PR, including a wrong head and deleted head repository", async () => {
    writeManifest({
      repo_title: "gm-languages",
      pr_repo_full_name: "git-mastery/gm-languages",
      pr_number: 999,
    });
    const runner = vi
      .fn<GithubRunner>()
      .mockResolvedValueOnce(http({ login: "learner" }))
      .mockResolvedValueOnce("[]")
      .mockResolvedValueOnce(http({ login: "learner" }))
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
      "No matching open PR",
    );
    const updated = await provider.collect(args("create-pr-from-main"));
    expect(updated).toContain("Selected candidate: #8");
    expect(updated).toContain("wrong head branch");
    expect(updated).toContain("unknown (unavailable/deleted)");
    expect(updated).not.toContain("#999");
  });

  it("marks capped results and stays below the context cap", async () => {
    const { provider } = fixture(
      JSON.stringify(Array.from({ length: 30 }, (_, n) => pr(n + 1))),
    );
    const text = await provider.collect(args("create-pr-from-main"));
    expect(text).toContain("additional candidates may exist");
    expect(text).toContain("Selected candidate: #30");
    expect(text!.length).toBeLessThan(8000);
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
      .mockImplementationOnce(
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
    expect(text).toContain("Authenticated GitHub account: learner");
    expect(text).toContain("unknown: timeout");
  });

  it("puts metadata and its limitations in the model prompt", async () => {
    const { provider } = fixture(JSON.stringify([pr()]));
    const text = await provider.collect(args("create-pr-from-main"));
    const prompt = buildSystemPrompt(workspaceSource("create-pr-from-main"), [
      { id: provider.id, label: provider.label, text: text! },
    ]);
    expect(prompt).toContain("## GitHub state");
    expect(prompt).toContain("Selected candidate: #1");
    expect(prompt).toContain("GitHub query failures mean unknown");
    expect(prompt).toContain("committed Java.txt content");
    expect(prompt).toContain("Never give the complete solution");
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
