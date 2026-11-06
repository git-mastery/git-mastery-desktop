import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

if (!["darwin", "linux", "win32"].includes(process.platform)) {
  throw new Error(`Unsupported E2E platform: ${process.platform}`);
}

const outputDir = (process.env.GM_E2E_RESULTS ??= path.join(
  os.tmpdir(),
  `git-mastery-e2e-results-${process.pid}`,
));

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(outputDir, "results.json") }],
  ],
  outputDir,
});
