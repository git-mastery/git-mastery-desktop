import fs from "fs";
import path from "path";
import { getConfig } from "./storage.js";
import { getExerciseDirectory } from "./utils/cli/getters.js";
import { HANDS_ON_PREFIX } from "./exerciseManifest.js";

type CliProgressRecord = {
  exercise_name?: string;
  status?: string;
};

let progressCache: ProgressData | null = null;

export function resetExerciseProgressCache() {
  progressCache = null;
}

export function patchExerciseProgress(
  exerciseIdentifier: string,
  status: ProgressState,
) {
  if (!progressCache) {
    progressCache = computeExerciseProgress();
  }
  progressCache[exerciseIdentifier] = { status };
}

export function getExerciseProgress(): ProgressData {
  if (progressCache) return progressCache;
  progressCache = computeExerciseProgress();
  return progressCache;
}

function computeExerciseProgress(): ProgressData {
  if (!getConfig().dataDirectory) return {};

  let exerciseDirectory: string;
  try {
    exerciseDirectory = getExerciseDirectory();
  } catch {
    return {};
  }

  if (!fs.existsSync(exerciseDirectory)) return {};

  const exerciseFolders = fs
    .readdirSync(exerciseDirectory)
    .filter((file) => {
      return fs.statSync(path.join(exerciseDirectory, file)).isDirectory();
    })
    // `progress` and `.gitmastery` hold CLI metadata, not exercises.
    .filter((exercise) => exercise !== "progress" && !exercise.startsWith("."));

  const cliStatusByName = readCliProgress(exerciseDirectory);
  const downloaded: ProgressData = {};

  for (const exerciseId of exerciseFolders) {
    if (exerciseId.startsWith(HANDS_ON_PREFIX)) {
      downloaded[exerciseId] = { status: "downloaded" };
      continue;
    }

    const cliStatus = cliStatusByName.get(exerciseId);
    if (!cliStatus) {
      downloaded[exerciseId] = { status: "downloaded" };
    } else if (cliStatus === "completed") {
      downloaded[exerciseId] = { status: "completed" };
    } else {
      downloaded[exerciseId] = { status: "in-progress" };
    }
  }

  return downloaded;
}

function resolveCliProgressPath(exerciseDirectory: string): string | null {
  const candidates = [
    path.join(exerciseDirectory, "progress", "progress.json"),
    path.join(exerciseDirectory, ".gitmastery", "progress.json"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function readCliProgress(
  exerciseDirectory: string,
): Map<string, ProgressState> {
  const filePath = resolveCliProgressPath(exerciseDirectory);
  const byName = new Map<string, ProgressState>();
  if (!filePath) return byName;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const records = JSON.parse(raw) as CliProgressRecord[];
    if (!Array.isArray(records)) return byName;

    for (const record of records) {
      const name = record.exercise_name;
      if (!name) continue;
      const completed = (record.status ?? "").toLowerCase() === "completed";
      const next: ProgressState = completed ? "completed" : "in-progress";
      const previous = byName.get(name);
      if (previous === "completed") continue;
      byName.set(name, next);
    }
  } catch (err) {
    console.error("[error] failed to parse CLI progress.json: ", err);
  }

  return byName;
}
