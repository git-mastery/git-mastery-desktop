import { shell } from "electron";
import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  getCliEnvironment,
  resolveGitMasteryBinary,
} from "../utils/cli/getters.js";
import { getConfig } from "../storage.js";
import { logGM } from "../utils/logger.js";
import { downloadReleaseAsset } from "../utils/cli/downloadReleaseAsset.js";
import { downloadApp as downloadAppDarwin } from "../utils/darwin/downloadApp.js";
import fs from "fs";

const execFileAsync = promisify(execFile);

export const setupPrereqIpc = () => {
  ipcMainHandle("download-gitmastery-app", async () => {
    try {
      await downloadGitMasteryApp();
      return true;
    } catch {
      return false;
    }
  });

  // empty string --> not downloaded
  ipcMainHandle("get-gitmastery-version", async () => {
    const binary = resolveGitMasteryBinary();
    if (!binary) return { version: "" };
    try {
      const { stdout } = await execFileAsync(binary, ["version"], {
        env: getCliEnvironment(),
      });
      return { ...parseOutput(stdout), path: binary };
    } catch {
      return { version: "" };
    }
  });

  // Open a URL in the system's default browser.
  // Uses shell.openExternal which is the Electron-safe way to open external links.
  ipcMainOn("open-external", ({ url }: { url: string }) => {
    shell.openExternal(url);
  });
};

async function downloadGitMasteryApp() {
  const dataDirectory = getConfig().dataDirectory;

  if (!dataDirectory || !fs.existsSync(dataDirectory)) {
    throw new Error(
      "Exercise directory not found - maybe you haven't chosen a save directory yet?",
    );
  }

  if (process.platform === "win32") {
    logGM("download", "exe", "Downloading gitmastery.exe from Github...");
    await downloadReleaseAsset(dataDirectory, {
      pickAsset: (assets) => assets.find((a) => a.name === "gitmastery.exe"),
      fileName: "gitmastery.exe",
    });
    logGM("download", "exe", "Download complete.");
  }

  if (process.platform === "darwin") {
    logGM("download", "darwin", "Installing gitmastery via Homebrew...");
    await downloadAppDarwin();
    logGM("download", "darwin", "Done.");
  }

  if (process.platform === "linux") {
    const linuxArch = process.arch === "arm64" ? "arm64" : "amd64";
    logGM(
      "download",
      "linux",
      "Downloading gitmastery binary from GitHub releases...",
    );
    await downloadReleaseAsset(dataDirectory, {
      pickAsset: (assets) =>
        assets.find((a) =>
          new RegExp(`^gitmastery-\\d+\\.\\d+\\.\\d+-linux-${linuxArch}$`).test(
            a.name,
          ),
        ),
      fileName: "gitmastery",
      executable: true,
    });
    logGM("download", "linux", "Done.");
  }
}

/**
 *  WARN  Your version of Git-Mastery app v7.7.0 is behind the latest version v7.8.2.
 *  WARN  We strongly recommend upgrading your app.
 *  WARN  Follow the update guide here: https://git-mastery.org/companion-app/index.html#updating-the-git-mastery-app
 *  INFO  Git-Mastery app is v7.7.0
 */
export function parseOutput(stdout: string): {
  version: string;
  latest?: string;
} {
  let version = "";
  let latest: string | undefined = undefined;

  const warnMatch = stdout.match(
    /behind the latest version v([\d]+(?:\.[\d]+)*)/,
  );
  if (warnMatch) {
    latest = warnMatch[1];
  }

  const infoMatch = stdout.match(/Git-Mastery app is v([\d]+(?:\.[\d]+)*)/);
  if (infoMatch) {
    version = infoMatch[1];
  } else {
    // Fallback: just try to find vX.Y.Z
    const fallbackMatch = stdout.match(/v([\d]+(?:\.[\d]+)*)/);
    if (fallbackMatch) {
      version = fallbackMatch[1];
    }
  }

  return { version, latest };
}
