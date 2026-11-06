import { execFile } from "node:child_process";
import { z } from "zod";
import { getCliEnvironment } from "../utils/cli/getters.js";

export type GithubUnknownReason =
  | "cli-missing"
  | "auth-required"
  | "auth-rejected"
  | "not-found-or-inaccessible"
  | "forbidden"
  | "rate-limited"
  | "timeout"
  | "network"
  | "invalid-response"
  | "unsupported-target";

export type GithubOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "unknown"; reason: GithubUnknownReason };

export type GithubRunOptions = {
  signal: AbortSignal;
  timeout: number;
  env: NodeJS.ProcessEnv;
};
export type GithubRunner = (
  args: string[],
  options: GithubRunOptions,
) => Promise<string>;

export const GITHUB_MAX_OUTPUT = 1024 * 1024;
export const PR_TARGET = "git-mastery/gm-languages";
export const PR_LIMIT = 30;

/** No shell or interactive stdin. Exported separately for real-process tests. */
export function runGithubProcess(
  executable: string,
  args: string[],
  options: GithubRunOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      {
        ...options,
        encoding: "utf8",
        maxBuffer: GITHUB_MAX_OUTPUT,
        windowsHide: true,
        killSignal: "SIGKILL",
      },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve(stdout);
      },
    );
    child.stdin?.end();
  });
}

const loginSchema = z
  .string()
  .max(39)
  .regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/);
const repoNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w.-]+$/)
  .refine((name) => name !== "." && name !== "..");
const fullNameSchema = z.string().refine((value) => {
  const parts = value.split("/");
  return (
    parts.length === 2 &&
    loginSchema.safeParse(parts[0]).success &&
    repoNameSchema.safeParse(parts[1]).success
  );
});
const refSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      !/\s/.test(value) &&
      ![...value].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
  );
const repositorySchema = z
  .object({
    full_name: fullNameSchema,
    fork: z.boolean(),
    private: z.boolean(),
    visibility: z.enum(["public", "private", "internal"]),
    parent: z.object({ full_name: fullNameSchema }).nullish(),
  })
  .refine((repo) => repo.private === (repo.visibility !== "public"));
const prSchema = z.object({
  number: z.number().int().positive(),
  state: z.literal("OPEN"),
  isDraft: z.boolean(),
  headRefName: refSchema,
  headRefOid: z.string().regex(/^[a-fA-F0-9]{40}$/),
  headRepository: z.object({ name: repoNameSchema }).nullable(),
  headRepositoryOwner: z.object({ login: loginSchema }).nullable(),
  baseRefName: refSchema,
});
export type GithubRepository = z.infer<typeof repositorySchema>;
export type GithubPullRequest = z.infer<typeof prSchema>;

type HttpResponse = {
  status: number | null;
  headers: Record<string, string>;
  body: string;
};

/** `gh api --include` can include redirect/proxy headers before the final response. */
function httpResponse(stdout: string): HttpResponse {
  let body = stdout;
  let status: number | null = null;
  let headers: Record<string, string> = {};
  while (body.startsWith("HTTP/")) {
    const match = /^HTTP\/[\d.]+ (\d{3})[^\r\n]*/.exec(body);
    const separator = /\r?\n\r?\n/.exec(body);
    if (!match || !separator) break;
    status = Number(match[1]);
    headers = {};
    for (const line of body.slice(0, separator.index).split(/\r?\n/).slice(1)) {
      const colon = line.indexOf(":");
      if (colon > 0) {
        headers[line.slice(0, colon).toLowerCase()] = line
          .slice(colon + 1)
          .trim();
      }
    }
    body = body.slice(separator.index + separator[0].length);
  }
  return { status, headers, body };
}

function environment(): NodeJS.ProcessEnv {
  const env = getCliEnvironment();
  for (const key of Object.keys(env)) {
    if (
      [
        "GH_DEBUG",
        "DEBUG",
        "GH_FORCE_TTY",
        "CLICOLOR_FORCE",
        "FORCE_COLOR",
      ].includes(key.toUpperCase())
    ) {
      delete env[key];
    }
  }
  return {
    ...env,
    GH_HOST: "github.com",
    GH_PROMPT_DISABLED: "1",
    GH_NO_UPDATE_NOTIFIER: "1",
    GH_NO_EXTENSION_UPDATE_NOTIFIER: "1",
    GH_TELEMETRY: "0",
    DO_NOT_TRACK: "1",
    NO_COLOR: "1",
  };
}

function failureReason(
  error: unknown,
  response: HttpResponse,
): GithubUnknownReason {
  const err = error as {
    code?: string | number;
    killed?: boolean;
    stderr?: string;
  } | null;
  const detail = `${response.body}\n${err?.stderr ?? ""}`;
  if (
    response.status === 429 ||
    ((response.status === 403 || response.status === null) &&
      (response.headers["x-ratelimit-remaining"] === "0" ||
        response.headers["retry-after"] !== undefined ||
        /(?:API rate limit exceeded|secondary rate limit|rate limit exceeded)/i.test(
          detail,
        )))
  )
    return "rate-limited";
  if (response.status === 401) return "auth-rejected";
  if (response.status === 404) return "not-found-or-inaccessible";
  if (response.status === 403) return "forbidden";
  if (err?.code === "ENOENT") return "cli-missing";
  if (err?.code === 4) return "auth-required";
  if (err?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
    return "invalid-response";
  if (err?.code === "ABORT_ERR" || err?.killed) return "timeout";
  // GraphQL commands do not emit HTTP headers; only classify explicit status hints.
  if (/\bHTTP 401\b/.test(detail)) return "auth-rejected";
  if (/\bHTTP 403\b/.test(detail)) return "forbidden";
  if (/\bHTTP 429\b/.test(detail)) return "rate-limited";
  return "network";
}

/**
 * Exactly three read operations. Only retry timing persists; account, repository
 * and PR facts are always recollected. A host cooldown also covers rate limiting
 * before the account can be resolved.
 */
export function createGithubCli(
  runner: GithubRunner = (args, options) =>
    runGithubProcess("gh", args, options),
) {
  let retryNotBefore = 0;

  async function query<T>(
    args: string[],
    schema: z.ZodType<T>,
    signal: AbortSignal,
    rest = false,
  ): Promise<GithubOutcome<T>> {
    if (signal.aborted) return { status: "unknown", reason: "timeout" };
    if (Date.now() < retryNotBefore)
      return { status: "unknown", reason: "rate-limited" };
    let stdout = "";
    let error: unknown = null;
    try {
      stdout = await runner(args, {
        signal,
        timeout: 1500,
        env: environment(),
      });
    } catch (err) {
      error = err;
      const output = (err as { stdout?: unknown })?.stdout;
      if (typeof output === "string") stdout = output;
    }
    if (signal.aborted) return { status: "unknown", reason: "timeout" };
    if (Buffer.byteLength(stdout) > GITHUB_MAX_OUTPUT) {
      return { status: "unknown", reason: "invalid-response" };
    }
    const response = rest
      ? httpResponse(stdout)
      : { status: null, headers: {}, body: stdout };
    if (error || (response.status !== null && response.status >= 400)) {
      const reason = failureReason(error, response);
      if (reason === "rate-limited") {
        const retry = response.headers["retry-after"];
        const after =
          retry && /^\d+$/.test(retry)
            ? Date.now() + Number(retry) * 1000
            : Date.parse(retry ?? "");
        const reset = Number(response.headers["x-ratelimit-reset"]) * 1000;
        retryNotBefore = Math.max(
          Date.now() + 1000,
          after || reset || Date.now() + 60_000,
        );
      }
      return { status: "unknown", reason };
    }
    if (
      rest &&
      (response.status === null ||
        response.status < 200 ||
        response.status >= 300)
    ) {
      return { status: "unknown", reason: "invalid-response" };
    }
    try {
      const parsed = schema.safeParse(JSON.parse(response.body));
      return parsed.success
        ? { status: "ok", value: parsed.data }
        : { status: "unknown", reason: "invalid-response" };
    } catch {
      return { status: "unknown", reason: "invalid-response" };
    }
  }

  const apiArgs = (endpoint: string) => [
    "api",
    "--hostname",
    "github.com",
    "--method",
    "GET",
    "--include",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
    endpoint,
  ];
  return {
    identity: (signal: AbortSignal) =>
      query(apiArgs("user"), z.object({ login: loginSchema }), signal, true),
    repository: (
      target: string,
      signal: AbortSignal,
    ): Promise<GithubOutcome<GithubRepository>> =>
      fullNameSchema.safeParse(target).success
        ? query(apiArgs(`repos/${target}`), repositorySchema, signal, true)
        : Promise.resolve({ status: "unknown", reason: "unsupported-target" }),
    openPullRequests: (
      login: string,
      signal: AbortSignal,
    ): Promise<GithubOutcome<GithubPullRequest[]>> =>
      loginSchema.safeParse(login).success
        ? query(
            [
              "pr",
              "list",
              "--repo",
              `github.com/${PR_TARGET}`,
              "--author",
              login,
              "--state",
              "open",
              "--limit",
              String(PR_LIMIT),
              "--json",
              "number,state,isDraft,headRefName,headRefOid,headRepository,headRepositoryOwner,baseRefName",
            ],
            z.array(prSchema).max(PR_LIMIT),
            signal,
          )
        : Promise.resolve({ status: "unknown", reason: "unsupported-target" }),
  };
}
