import { LESSONS, LESSON_ORDER, type LessonEntry } from "./curriculumData.js";

const EXERCISES_URL =
  "https://git-mastery.org/exercises-directory/exercises.json";

/**
 * The subset of exercises.json this module reads. Only the lesson *name* is
 * taken: it is the join key into the vendored lesson table. The lesson titles
 * embedded here are deliberately ignored, so that every piece of lesson
 * information reaching the model comes from one source.
 */
type ExercisesResponse = {
  [key: string]: {
    lesson?: { lesson_name?: string };
    detour?: { lesson?: { lesson_name?: string } };
    identifier?: string;
  };
};

/**
 * Resolved exercise identifier -> lesson_name, or null until the one-shot
 * fetch lands. Read synchronously on the send path; never awaited there.
 */
let lessonByExercise: Record<string, string> | null = null;
let started = false;

/**
 * Kicks off the single exercises.json fetch. Safe to call more than once, and
 * deliberately returns nothing: callers must not wait on it. A failure leaves
 * `lessonByExercise` null, which degrades to no curriculum block rather than
 * to a delayed or hanging message send.
 */
export function prefetchCurriculum(): void {
  if (started) return;
  started = true;

  void (async () => {
    try {
      const response = await fetch(EXERCISES_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const exercises = (await response.json()) as ExercisesResponse;

      const resolved: Record<string, string> = {};
      for (const exercise of Object.values(exercises)) {
        // Detour-only exercises carry no top-level `lesson`.
        const lessonName =
          exercise.lesson?.lesson_name ?? exercise.detour?.lesson?.lesson_name;
        // Keyed on `identifier` (hyphenated), which is what the AI path
        // receives. The object keys are underscored and must not be used.
        if (exercise.identifier && lessonName) {
          resolved[exercise.identifier] = lessonName;
        }
      }
      lessonByExercise = resolved;
      console.log(
        `[ai] curriculum: mapped ${Object.keys(resolved).length} exercises to lessons`,
      );
    } catch (err) {
      console.warn("[ai] curriculum: failed to load exercises.json:", err);
    }
  })();
}

function rank(entry: LessonEntry): number {
  return entry.tour * 1000 + entry.lesson;
}

function getLesson(exerciseId: string): LessonEntry | null {
  const lessonName = lessonByExercise?.[exerciseId];
  if (!lessonName) return null;
  return LESSONS[lessonName] ?? null;
}

/**
 * The course-position block: where the student is, what they may rely on, and
 * an explicit list of everything still ahead of them.
 *
 * The forward list is uncapped. It is ~1KB at the very first lesson and shrinks
 * as the student advances, so it is largest exactly when the student knows
 * least; capping it would drop the far-future material (rebasing,
 * cherry-picking) that a model is most likely to reach for wrongly.
 */
export function buildCurriculumText(exerciseId: string): string | null {
  const current = getLesson(exerciseId);
  if (!current) return null;

  const currentRank = rank(current);
  const upcoming = LESSON_ORDER.filter(
    (name) => LESSONS[name] && rank(LESSONS[name]) > currentRank,
  ).map((name) => `${LESSONS[name].pos} ${name}`);

  const lines = [
    `Course position: ${current.pos} — ${current.title}`,
    `Concepts the student can rely on: ${current.concepts}`,
  ];

  if (upcoming.length > 0) {
    lines.push(
      `Not taught yet, do not introduce: ${upcoming.join(", ")}`,
      `If an answer seems to need one of those, say this exercise does not require it and redirect to what the student has already learned.`,
    );
  }

  return lines.join("\n");
}
