import fs from "fs";
import path from "path";
import { ipcMainHandle } from "./utils/util.js";
import { getConfig, saveConfig } from "./storage.js";
import {
  isExerciseRoot,
  resolveGitMasteryBinary,
} from "./utils/cli/getters.js";
import { findGitBash } from "./ipc/terminal.js";

const INVALID_ROOT =
  "That folder is not a Git-Mastery exercises folder. Run gitmastery setup, then choose the folder it created.";

export type ToolsStatus = {
  cli: boolean;
  /** Null off Windows, where Git Bash is not required. */
  gitBash: boolean | null;
};

export function getToolsStatus(): ToolsStatus {
  return {
    cli: resolveGitMasteryBinary() !== null,
    gitBash: process.platform === "win32" ? findGitBash() !== null : null,
  };
}

export function hasValidExerciseRoot(): boolean {
  const root = getConfig().exercisesRoot;
  return Boolean(root && isExerciseRoot(root));
}

/** The first Start step that is still outstanding, ignoring the introduction. */
export function getBlockingPrereq(): "tools" | "folder" | null {
  const tools = getToolsStatus();
  if (!tools.cli || tools.gitBash === false) return "tools";
  if (!hasValidExerciseRoot()) return "folder";
  return null;
}

/**
 * Intro, then tools, then the exercises folder. Null means Start can run.
 * The intro is skipped by Verify; use `getBlockingPrereq` there. A Start that
 * already showed the intro this attempt passes `skipIntro`.
 */
export function getStartPrereqStep(options?: {
  skipIntro?: boolean;
}): FirstRunStep | null {
  if (!options?.skipIntro && !getConfig().hideStartIntro) return "intro";
  return getBlockingPrereq();
}

export function prereqFailureMessage(step: "tools" | "folder"): string {
  if (step === "folder") {
    return "No exercises folder is set. Start an exercise and choose the folder that gitmastery setup created.";
  }

  const tools = getToolsStatus();
  if (!tools.cli && tools.gitBash === false) {
    return "Git-Mastery and Git Bash were not found. Install them, then restart the app.";
  }
  if (tools.gitBash === false) {
    return "Git Bash was not found. Install Git for Windows, then restart the app.";
  }
  if (tools.gitBash === null) {
    return "The Git-Mastery CLI was not found. Install it from the lesson instructions, then try again.";
  }
  return "The Git-Mastery CLI was not found. Install it, then restart the app.";
}

/**
 * Accepts a folder that is an exercises root, or a parent that contains exactly
 * one. Learners often pick the folder they ran setup from, one level up.
 */
export function resolveExerciseRootPick(
  directory: string,
): { ok: true; root: string } | { ok: false; error: string } {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(directory);
  } catch {
    return { ok: false, error: INVALID_ROOT };
  }
  if (!stat.isDirectory()) return { ok: false, error: INVALID_ROOT };
  if (isExerciseRoot(directory)) return { ok: true, root: directory };

  let children: string[];
  try {
    children = fs.readdirSync(directory);
  } catch {
    return { ok: false, error: INVALID_ROOT };
  }

  const roots = children.filter((name) => {
    const child = path.join(directory, name);
    try {
      return fs.statSync(child).isDirectory() && isExerciseRoot(child);
    } catch {
      return false;
    }
  });

  if (roots.length === 1) {
    return { ok: true, root: path.join(directory, roots[0]) };
  }
  return { ok: false, error: INVALID_ROOT };
}

export function setupStartPrereqIpc() {
  ipcMainHandle("check-start-prereqs", async (payload) => ({
    step: getStartPrereqStep({ skipIntro: payload?.skipIntro }),
    tools: getToolsStatus(),
  }));

  ipcMainHandle("hide-start-intro", async () => {
    saveConfig({ hideStartIntro: true });
    return true;
  });
}
