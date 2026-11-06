import {
  _electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const windows = process.platform === "win32";
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const readLines = (file: string): unknown[] =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

export class Desktop {
  readonly directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-e2e-")),
  );
  // Spaces and an apostrophe also exercise production shell quoting.
  readonly root = path.join(this.directory, "learner's exercises");
  readonly profile = path.join(this.directory, "profile");
  readonly repository = path.join(this.root, "under-control", "control-me");
  readonly cliLog = path.join(this.directory, "cli.jsonl");
  readonly networkLog = path.join(this.directory, "network.jsonl");
  readonly cli = path.join(
    this.directory,
    "bin",
    windows ? "gitmastery.exe" : "gitmastery",
  );
  readonly logs: string[] = [];
  app!: ElectronApplication;
  page!: Page;
  private running = false;

  constructor() {
    for (const folder of [
      this.profile,
      this.root,
      path.join(this.directory, "home"),
      path.join(this.directory, "bin"),
      path.join(this.root, "progress"),
    ]) {
      fs.mkdirSync(folder, { recursive: true });
    }
    fs.writeFileSync(path.join(this.root, ".gitmastery.json"), "{}");
    fs.writeFileSync(path.join(this.root, "progress", "progress.json"), "[]");
    fs.writeFileSync(
      path.join(this.profile, "config.json"),
      JSON.stringify({ exercisesRoot: this.root, theme: "light" }),
    );
    if (windows) {
      // A real PE executable, not a .cmd shim. Bootstrap supplies cli.mjs.
      fs.copyFileSync(process.execPath, this.cli);
    } else
      fs.writeFileSync(
        this.cli,
        `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(path.join(repo, "tests/e2e/cli.mjs"))} "$@"\n`,
        { mode: 0o755 },
      );
    fs.writeFileSync(
      path.join(this.directory, "shell"),
      "#!/bin/sh\nexec /bin/bash --noprofile --norc\n",
      { mode: 0o755 },
    );
  }

  async launch() {
    // Windows needs SystemRoot/COMSPEC and Git for Windows on PATH. Linux
    // needs the Xvfb display and (where supplied) its Xauthority cookie.
    const hostEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key, value]) =>
          value !== undefined &&
          /^(SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_SESSION_BUS_ADDRESS)$/i.test(
            key,
          ),
      ),
    ) as Record<string, string>;
    const inheritedPath =
      Object.entries(process.env).find(
        ([key]) => key.toUpperCase() === "PATH",
      )?.[1] ?? "";
    this.app = await _electron.launch({
      args: [
        path.join(repo, "tests/e2e/bootstrap.mjs"),
        `--user-data-dir=${this.profile}`,
        ...(process.platform === "linux" && process.env.CI
          ? ["--no-sandbox"]
          : []),
      ],
      cwd: repo,
      env: {
        ...hostEnvironment,
        NODE_ENV: "production",
        PATH: [
          path.join(this.directory, "bin"),
          windows ? inheritedPath : "/usr/bin:/bin:/usr/sbin:/sbin",
        ].join(path.delimiter),
        HOME: path.join(this.directory, "home"),
        USERPROFILE: path.join(this.directory, "home"),
        SHELL: path.join(this.directory, "shell"),
        LANG: "en_US.UTF-8",
        TMPDIR: os.tmpdir(),
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: path.join(this.directory, "home", ".gitconfig"),
        GM_E2E_REPO: repo,
        GM_E2E_ROOT: this.root,
        GM_E2E_CLI: this.cli,
        GM_E2E_CLI_SCRIPT: path.join(repo, "tests/e2e/cli.mjs"),
        GM_E2E_CLI_LOG: this.cliLog,
        GM_E2E_NETWORK_LOG: this.networkLog,
        GM_E2E_REJECT_VERIFY: process.env.GM_E2E_REJECT_VERIFY ?? "",
      },
    });
    this.running = true;
    this.app
      .process()
      .stdout?.on("data", (data) => this.logs.push(String(data)));
    this.app
      .process()
      .stderr?.on("data", (data) => this.logs.push(String(data)));
    this.page = await this.app.firstWindow();
    this.page.on("pageerror", (error) =>
      this.logs.push(`PAGE ERROR: ${error}`),
    );
    await this.page.waitForLoadState("domcontentloaded");
  }

  async onboard() {
    await this.page
      .getByRole("button", { name: "Get Started", exact: true })
      .click();
    await this.page.getByRole("button", { name: "Next", exact: true }).click();
    await this.page.getByRole("button", { name: "Done", exact: true }).click();
    await this.openLesson();
  }

  async openLesson() {
    const tour = this.page
      .getByRole("button")
      .filter({ hasText: /^Fixture tour$/ });
    if ((await tour.getAttribute("aria-expanded")) !== "true")
      await tour.click();
    const lesson = this.page
      .getByRole("button")
      .filter({ hasText: /^Fixture lesson$/ });
    if ((await lesson.getAttribute("aria-expanded")) !== "true")
      await lesson.click();
    await expect(this.exerciseRow()).toBeVisible();
  }

  exerciseRow() {
    return this.page.getByRole("button").filter({ hasText: "Under Control" });
  }

  async lessonPage() {
    await expect
      .poll(() =>
        this.app
          .context()
          .pages()
          .some((page) => new URL(page.url()).pathname === "/lessons/init/"),
      )
      .toBe(true);
    return this.app
      .context()
      .pages()
      .find((page) => new URL(page.url()).pathname === "/lessons/init/")!;
  }

  async start() {
    const lesson = await this.lessonPage();
    await lesson.locator('[data-gm-start="under-control"]').click();
    await this.page
      .getByRole("button", { name: "Continue", exact: true })
      .click();
  }

  async typeCommand(command: string) {
    const input = this.page.locator(".xterm-helper-textarea");
    await input.focus();
    await input.pressSequentially(command);
    await input.press("Enter");
  }

  calls() {
    return readLines(this.cliLog);
  }

  requests() {
    return readLines(this.networkLog) as { url: string; allowed: boolean }[];
  }

  async close() {
    if (!this.running) return;
    await this.app.close();
    this.running = false;
  }

  async restart() {
    await this.close();
    await this.launch();
    await this.openLesson();
  }
}

export const test = base.extend<{ desktop: Desktop }>({
  // Playwright requires destructuring even when no other fixtures are needed.
  // eslint-disable-next-line no-empty-pattern
  desktop: async ({}, runTest, testInfo) => {
    const desktop = new Desktop();
    try {
      await desktop.launch();
      await runTest(desktop);
    } finally {
      try {
        if (testInfo.status !== testInfo.expectedStatus && desktop.page) {
          const screenshot = await desktop.page
            .screenshot({ timeout: 3_000 })
            .catch(() => null);
          if (screenshot)
            await testInfo.attach("desktop-renderer", {
              body: screenshot,
              contentType: "image/png",
            });
        }
        await desktop.close();
        await testInfo.attach("process-log", {
          body: desktop.logs.join(""),
          contentType: "text/plain",
        });
        await testInfo.attach("cli-calls", {
          body: JSON.stringify(desktop.calls(), null, 2),
          contentType: "application/json",
        });
        await testInfo.attach("network-requests", {
          body: JSON.stringify(desktop.requests(), null, 2),
          contentType: "application/json",
        });
        expect(
          desktop.requests().filter((request) => !request.allowed),
          "No unplanned network requests",
        ).toEqual([]);
      } finally {
        fs.rmSync(desktop.directory, {
          recursive: true,
          force: true,
          maxRetries: windows ? 5 : 0,
          retryDelay: 100,
        });
      }
    }
  },
});

export { expect };
