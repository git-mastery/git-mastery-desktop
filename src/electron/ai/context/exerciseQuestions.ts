import fs from "fs";
import path from "path";
import type { ContextProvider } from "../context.js";
import { readExerciseManifest } from "../../exerciseManifest.js";

/** Question files are short; this is a hard stop against a student dumping a tree into one. */
const MAX_BYTES = 32 * 1024;
const MAX_QUESTIONS = 30;

const QUESTION_LINE = /^Q:\s*(.+)$/;

function isSafeRelative(rel: string): boolean {
  if (
    !rel ||
    path.isAbsolute(rel) ||
    rel.includes("\\") ||
    rel.includes("\0")
  ) {
    return false;
  }
  const parts = rel.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

/**
 * A regular file under `exerciseRoot`, reached without following a symlink of
 * the file itself and without leaving the exercise folder via `..` or an
 * absolute destination from the manifest.
 */
function containedFile(exerciseRoot: string, rel: string): string | null {
  if (!isSafeRelative(rel)) return null;
  const candidate = path.resolve(exerciseRoot, rel);
  let rootReal: string;
  try {
    rootReal = fs.realpathSync(exerciseRoot);
  } catch {
    return null;
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(candidate);
  } catch {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  if (stat.size === 0 || stat.size > MAX_BYTES) return null;
  let parentReal: string;
  try {
    parentReal = fs.realpathSync(path.dirname(candidate));
  } catch {
    return null;
  }
  const fileReal = path.join(parentReal, path.basename(candidate));
  const fromRoot = path.relative(rootReal, fileReal);
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    return null;
  }
  return candidate;
}

export function extractQuestionStems(text: string): string[] {
  const stems: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = QUESTION_LINE.exec(line);
    const stem = match?.[1]?.trim();
    if (stem) stems.push(stem);
    if (stems.length >= MAX_QUESTIONS) break;
  }
  return stems;
}

export const exerciseQuestionsProvider: ContextProvider = {
  id: "exercise-questions",
  label: "Exercise questions (answers omitted)",
  async collect({ location }) {
    if (!location) return null;
    const manifest = readExerciseManifest(location.exerciseRoot);
    const destinations = [
      ...new Set(Object.values(manifest?.base_files ?? {})),
    ];
    if (destinations.length === 0) return null;

    const displayRoot = path.dirname(location.exercisesRoot);
    const sections: string[] = [];
    for (const dest of destinations) {
      const file = containedFile(location.exerciseRoot, dest);
      if (!file) continue;
      let text: string;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const stems = extractQuestionStems(text);
      if (stems.length === 0) continue;
      const shown = path.relative(displayRoot, file) || dest;
      sections.push(
        `${shown}:\n${stems.map((stem) => `- ${stem}`).join("\n")}`,
      );
    }
    if (sections.length === 0) return null;
    return [
      "Question stems from files the exercise placed in the exercise folder. Answer lines and any other file contents were omitted.",
      ...sections,
    ].join("\n\n");
  },
};
