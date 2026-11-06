import { describe, expect, it, vi } from "vitest";
import { createGithubCli } from "../../../src/electron/ai/githubCli.js";

// The CLI is real; only avoid importing Electron storage in the Node test runner.
vi.mock("../../../src/electron/utils/cli/getters.js", () => ({
  getCliEnvironment: () => ({ ...process.env }),
}));

describe.skipIf(process.env.GIT_MASTERY_GITHUB_SMOKE !== "1")(
  "opt-in live GitHub metadata (read-only; existing gh authentication)",
  () => {
    it("reads identity and known public repository/fork fields through the production adapter", async () => {
      const cli = createGithubCli();
      const identity = await cli.identity(AbortSignal.timeout(2100));
      expect(identity.status).toBe("ok");
      const source = await cli.repository(
        "git-mastery/gm-shapes",
        AbortSignal.timeout(2100),
      );
      expect(source).toMatchObject({
        status: "ok",
        value: {
          full_name: "git-mastery/gm-shapes",
          fork: false,
          visibility: "public",
        },
      });
      const fork = await cli.repository(
        "damithc/gm-shapes",
        AbortSignal.timeout(2100),
      );
      expect(fork).toMatchObject({
        status: "ok",
        value: { fork: true, parent: { full_name: "git-mastery/gm-shapes" } },
      });
    });

    it("parses author-filtered PR metadata and an empty selection", async () => {
      const cli = createGithubCli();
      // Public example used in the feasibility check; it may close over time.
      const prs = await cli.openPullRequests(
        "git-mastery/gm-languages",
        "fuhlie",
        AbortSignal.timeout(2100),
      );
      expect(prs.status).toBe("ok");
      const empty = await cli.openPullRequests(
        "git-mastery/gm-languages",
        "git-mastery-nonexistent-smoke-account",
        AbortSignal.timeout(2100),
      );
      expect(empty).toEqual({ status: "ok", value: [] });
    });
  },
);
