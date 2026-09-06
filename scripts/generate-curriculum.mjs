#!/usr/bin/env node
/**
 * Regenerates src/electron/ai/curriculumData.ts from the Git-Mastery website's
 * canonical lesson sequence.
 *
 * That file is the single source of lesson information for the AI hints
 * feature: position, title, and the concepts a student may rely on at each
 * point. It is Markdown in an agent-tooling directory rather than a published,
 * versioned artifact, so it is vendored through this script instead of being
 * fetched at runtime — a table reformat then breaks this script in front of a
 * human, rather than silently killing the feature for every user at once.
 *
 * Usage: node scripts/generate-curriculum.mjs
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { format, resolveConfig } from "prettier";

const SOURCE_URL =
  "https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/.claude/skills/concepts-review/references/git-mastery-lesson-sequence.md";

/** The lesson table has exactly this many rows; fewer means the parse broke. */
const EXPECTED_LESSONS = 43;

/** `| T1L4 | `stage`: Some Title | Concepts; more concepts. |` */
const LESSON_ROW =
  /^\|\s*T(\d+)L(\d+)\s*\|\s*`([^`]+)`:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/;

const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "electron",
  "ai",
  "curriculumData.ts",
);

function fail(message) {
  console.error(`[generate-curriculum] ${message}`);
  console.error("[generate-curriculum] Source: " + SOURCE_URL);
  process.exit(1);
}

function parse(markdown) {
  const lessons = [];
  for (const line of markdown.split("\n")) {
    const match = LESSON_ROW.exec(line);
    if (!match) continue;
    const [, tour, lesson, name, title, concepts] = match;
    lessons.push({
      pos: `T${Number(tour)}L${Number(lesson)}`,
      tour: Number(tour),
      lesson: Number(lesson),
      name,
      title,
      concepts,
    });
  }
  return lessons;
}

/**
 * The deny list is computed by comparing ordinals, so a table that is not
 * strictly ascending in file order would silently produce a wrong ceiling.
 */
function validate(lessons) {
  if (lessons.length < EXPECTED_LESSONS) {
    fail(
      `parsed only ${lessons.length} lesson rows, expected at least ${EXPECTED_LESSONS}. ` +
        `The table format has probably changed.`,
    );
  }

  const seen = new Set();
  let previous = null;
  for (const entry of lessons) {
    if (seen.has(entry.name)) {
      fail(`duplicate lesson_name "${entry.name}".`);
    }
    seen.add(entry.name);

    const rank = entry.tour * 1000 + entry.lesson;
    if (previous !== null && rank <= previous) {
      fail(
        `ordinals are not strictly increasing at ${entry.pos} (${entry.name}). ` +
          `The deny list depends on file order matching course order.`,
      );
    }
    previous = rank;
  }
}

function render(lessons) {
  const rows = lessons
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.name)}: {\n` +
        `    pos: ${JSON.stringify(entry.pos)},\n` +
        `    tour: ${entry.tour},\n` +
        `    lesson: ${entry.lesson},\n` +
        `    title: ${JSON.stringify(entry.title)},\n` +
        `    concepts: ${JSON.stringify(entry.concepts)},\n` +
        `  },`,
    )
    .join("\n");

  const order = lessons
    .map((entry) => `  ${JSON.stringify(entry.name)},`)
    .join("\n");

  return `// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/generate-curriculum.mjs
//
// Source: ${SOURCE_URL}
//
// The canonical Git-Mastery lesson sequence. This is the only source of lesson
// information used by the AI hints feature — position, title, and the concepts
// a student may rely on at that point. exercises.json is consulted separately,
// and only to answer "which lesson is this exercise in".

export type LessonEntry = {
  /** Course position, e.g. "T1L4". */
  pos: string;
  tour: number;
  lesson: number;
  title: string;
  /** Concepts the student can rely on once this lesson is done. */
  concepts: string;
};

/** Keyed by \`lesson_name\`, which is the join key exercises.json provides. */
export const LESSONS: Record<string, LessonEntry> = {
${rows}
};

/** \`lesson_name\`s in course order. */
export const LESSON_ORDER: string[] = [
${order}
];
`;
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  fail(`fetch failed with HTTP ${response.status}.`);
}

const lessons = parse(await response.text());
validate(lessons);

// Formatted here so that re-running the generator after `npm run format` is a
// no-op, rather than producing a spurious diff every time.
const prettierConfig = await resolveConfig(OUT_PATH);
const output = await format(render(lessons), {
  ...prettierConfig,
  filepath: OUT_PATH,
});
writeFileSync(OUT_PATH, output, "utf8");

console.log(
  `[generate-curriculum] wrote ${lessons.length} lessons ` +
    `(${lessons[0].pos}..${lessons[lessons.length - 1].pos}) to ${OUT_PATH}`,
);
