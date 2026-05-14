import { ipcMain, shell } from 'electron';
import { ipcMainHandle, ipcMainOn } from "../utils/util.js"
import { exec } from "child_process"
import { promisify } from "util"
import { getGitMasteryExecutable, getEnvironmentWithHomebrew } from "../utils/cli/getters.js";
import { getConfig } from "../storage.js";
import { logGM } from "../utils/logger.js";
import { downloadGitMasteryExe } from "../utils/win32/downloadExe.js";
import { downloadApp as downloadAppDarwin } from "../utils/darwin/downloadApp.js";
import { downloadApp as downloadAppLinux } from "../utils/linux/downloadApp.js";
import fs from "fs";

const execAsync = promisify(exec);

export const setupPrereqIpc = () => {
  ipcMainHandle('check-git', async () => {
    return await checkGit();
  })

  ipcMainHandle('check-github-cli', async () => {
    return await checkGithubCli();
  })

  ipcMainHandle('download-gitmastery-app', async () => {
    try {
      await downloadGitMasteryApp();
      return true;
    } catch (e) {
      return false;
    }
  })

  // empty string --> not downloaded
  // 
  ipcMainHandle('get-gitmastery-version', async () => {
    console.log("getgitmasteryversion")
    // windows
    if (process.platform === "win32") {
      const exeLocation = getGitMasteryExecutable();
      const exists = fs.existsSync(exeLocation);
      if (!exists) return { version: "" }
      const { stdout } = await execAsync(`${exeLocation} version`);
      return parseOutput(stdout);
    }
    // mac
    if (process.platform === "darwin") {
      // gitmastery may not be installed yet — treat a missing command as version ""
      try {
        const { stdout } = await execAsync("gitmastery version", { env: getEnvironmentWithHomebrew() });
        return parseOutput(stdout);
      } catch {
        return { version: "" };
      }
    }
    // TODO(linux)
    if (process.platform === "linux") {
      const binaryLocation = getGitMasteryExecutable();
      const exists = fs.existsSync(binaryLocation);
      if (!exists) return { version: "" }
      const { stdout } = await execAsync(`${binaryLocation} version`);
      return parseOutput(stdout);
    }

    return { version: "" }
  })

  // Open a URL in the system's default browser.
  // Uses shell.openExternal which is the Electron-safe way to open external links.
  ipcMainOn('open-external', ({ url }: { url: string }) => {
    shell.openExternal(url);
  });
}

// simply spawn a terminal and check that the git command is available
async function checkGit(): Promise<boolean> {
  try {
    // If git is found, this command will succeed.
    await execAsync('git --version', { env: getEnvironmentWithHomebrew() });
    return true;
  } catch (error) {
    console.error('[checkGit] Git not found:', error);
    return false;
  }
}

// simply spawn a terminal and check that the gh command is available
async function checkGithubCli(): Promise<boolean> {
  try {
    // If GitHub CLI is found, this command will succeed.
    await execAsync('gh --version', { env: getEnvironmentWithHomebrew() });
    return true;
  } catch (error) {
    console.error('[checkGithubCli] GitHub CLI not found:', error);
    return false;
  }
}

async function downloadGitMasteryApp() {
  const exeLocation = getGitMasteryExecutable();
  const dataDirectory = getConfig().dataDirectory;

  console.log({ exeLocation, dataDirectory });

  // 1. Check if the data directory exists
  if (!dataDirectory || !fs.existsSync(dataDirectory)) {
    throw new Error('Exercise directory not found - maybe you haven\'t chosen a save directory yet?');
  }

  // 2a. Check if the exe exists (windows only) — auto-download if missing
  if (process.platform === "win32"
    //  && !fs.existsSync(exeLocation)
  ) {

    logGM('download', 'exe', 'Downloading gitmastery.exe from Github...');
    await downloadGitMasteryExe(dataDirectory);
    logGM('download', 'exe', 'Download complete.');
  }

  // 2b. Install via Homebrew (macOS only)
  if (process.platform === "darwin") {
    logGM('download', 'darwin', 'Installing gitmastery via Homebrew...');
    await downloadAppDarwin();
    logGM('download', 'darwin', 'Done.');
  }

  // 2c. Download binary from GitHub releases (Linux only)
  if (process.platform === "linux") {
    logGM('download', 'linux', 'Downloading gitmastery binary from GitHub releases...');
    await downloadAppLinux(dataDirectory);
    logGM('download', 'linux', 'Done.');
  }
}

/**
 *  WARN  Your version of Git-Mastery app v7.7.0 is behind the latest version v7.8.2.
 *  WARN  We strongly recommend upgrading your app.
 *  WARN  Follow the update guide here: https://git-mastery.org/companion-app/index.html#updating-the-git-mastery-app
 *  INFO  Git-Mastery app is v7.7.0
 */
export function parseOutput(stdout: string): { version: string, latest?: string } {
  let version = "";
  let latest: string | undefined = undefined;

  const warnMatch = stdout.match(/behind the latest version v([\d]+(?:\.[\d]+)*)/);
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