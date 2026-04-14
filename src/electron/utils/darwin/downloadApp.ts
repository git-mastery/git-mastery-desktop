import { exec } from "child_process";
import { promisify } from "util";
import { logGM } from "../logger.js";
import { getEnvironmentWithHomebrew } from "../cli/getters.js";

const execAsync = promisify(exec);

/**
 * Installs or updates the GitMastery CLI on macOS via Homebrew.
 *
 * Always runs `brew upgrade gitmastery || brew install gitmastery` so that
 * clicking the button fetches the latest version regardless of whether
 * gitmastery is already present. Throws if Homebrew itself is not installed.
 */
export const downloadApp = async (): Promise<void> => {
  const env = getEnvironmentWithHomebrew();

  // Verify Homebrew is available before attempting anything.
  try {
    await execAsync("brew --version", { env });
  } catch {
    throw new Error(
      "Homebrew is not installed. Please install Homebrew from https://brew.sh and then re-run this step."
    );
  }

  // Upgrade if already installed, otherwise install fresh.
  // This ensures clicking the button always gets the latest version.
  logGM("download", "darwin", "Running: brew upgrade gitmastery || brew install gitmastery");
  try {
    const { stdout, stderr } = await execAsync(
      "brew upgrade gitmastery || brew install gitmastery",
      { env }
    );
    if (stdout) logGM("download", "darwin", stdout.trim());
    if (stderr) logGM("download", "darwin", stderr.trim());
    logGM("download", "darwin", "gitmastery installed/updated successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to install/update gitmastery via Homebrew: ${message}`);
  }
};