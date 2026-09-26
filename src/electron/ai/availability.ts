import fs from "fs";
import path from "path";
import { isPathSegment, resolveExerciseCwd } from "../exerciseManifest.js";
import { getExerciseDirectory } from "../utils/cli/getters.js";
import { isAiConfigured } from "./settings.js";

export type ExerciseLocation = {
  /** The linked `gitmastery-exercises` folder. */
  exercisesRoot: string;
  /** `<exercisesRoot>/<exerciseId>`. */
  exerciseRoot: string;
  /** Where the learner is meant to work — Start would `cd` here. */
  cwd: string;
};

/** What the lesson page needs to enable or explain each AI Hints button. */
export type AiHintsPageState = {
  configured: boolean;
  ready: string[];
};

/**
 * Where a downloaded exercise lives, or null when it is not ready to work in.
 * Hints need this to describe the student's workspace, so an exercise that is
 * missing, corrupt, or half-downloaded cannot open a hint session at all.
 */
export function locateExercise(exerciseId: string): ExerciseLocation | null {
  if (!isPathSegment(exerciseId)) return null;
  let exercisesRoot: string;
  try {
    exercisesRoot = getExerciseDirectory();
  } catch {
    return null;
  }
  const exerciseRoot = path.join(exercisesRoot, exerciseId);
  const resolved = resolveExerciseCwd(exerciseRoot);
  return resolved.state === "ready"
    ? { exercisesRoot, exerciseRoot, cwd: resolved.cwd }
    : null;
}

function listReadyExercises(): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(getExerciseDirectory());
  } catch {
    return [];
  }
  return entries.filter(
    (name) =>
      !name.startsWith(".") &&
      name !== "progress" &&
      locateExercise(name) !== null,
  );
}

export function getAiHintsPageState(): AiHintsPageState {
  return { configured: isAiConfigured(), ready: listReadyExercises() };
}

let listener: ((state: AiHintsPageState) => void) | null = null;

/** The lesson page registers here so its buttons track downloads and Settings. */
export function onAiHintsPageStateChange(
  callback: (state: AiHintsPageState) => void,
) {
  listener = callback;
}

export function notifyAiHintsPageStateChanged() {
  listener?.(getAiHintsPageState());
}
