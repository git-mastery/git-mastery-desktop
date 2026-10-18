import type { Detours } from "../../types/Detour";
import type { Exercise, Exercises } from "../../types/Exercise";

type HandsOnInput = {
  identifier: string;
  title: string;
  panelId: string | null;
};

export type LessonOutlineHandsOn = {
  kind: "hands-on";
  identifier: string;
  title: string;
  panelId: string;
};

export type CataloguedExercise = {
  catalogKey: string;
  exercise: Exercise;
};

export type LessonOutlineExercise = {
  kind: "exercise";
} & CataloguedExercise;

export type LessonOutlineDetour = {
  kind: "detour";
  detourKey: string;
  title: string;
  exercises: CataloguedExercise[];
};

export type LessonOutlineItem =
  LessonOutlineHandsOn | LessonOutlineExercise | LessonOutlineDetour;

const detourIdentity = (lessonName: string, title: string) =>
  `${lessonName}\0${title}`;

/**
 * Ordered contents of one lesson: hands-on, then lesson exercises, then
 * detours (each with the exercises that belong to that detour).
 *
 * JSON key order is the order they appear on the lesson page. Exercises with a
 * `detour` nest under that detour rather than listing as lesson exercises.
 */
export function buildLessonOutline(
  lessonName: string,
  exercises: Exercises | undefined,
  detours: Detours | undefined,
  handsOn: HandsOnInput[] | undefined,
): LessonOutlineItem[] {
  const items: LessonOutlineItem[] = [];

  for (const hop of handsOn ?? []) {
    items.push({
      kind: "hands-on",
      identifier: hop.identifier,
      title: hop.title,
      panelId: hop.panelId ?? `hands-on-${hop.identifier}`,
    });
  }

  const detoursForLesson: { key: string; title: string }[] = [];
  const detourKeyByIdentity = new Map<string, string>();
  for (const [key, detour] of Object.entries(detours ?? {})) {
    if (detour.lesson.lesson_name !== lessonName) continue;
    detoursForLesson.push({ key, title: detour.title });
    detourKeyByIdentity.set(detourIdentity(lessonName, detour.title), key);
  }

  const lessonExercises: CataloguedExercise[] = [];
  const exercisesByDetourKey = new Map<string, CataloguedExercise[]>();

  for (const [catalogKey, exercise] of Object.entries(exercises ?? {})) {
    if (exercise.wip) continue;

    if (exercise.detour) {
      const parentLesson =
        exercise.detour.lesson.lesson_name || exercise.lesson?.lesson_name;
      if (parentLesson !== lessonName) continue;
      const key = detourKeyByIdentity.get(
        detourIdentity(parentLesson, exercise.detour.title),
      );
      if (key) {
        const list = exercisesByDetourKey.get(key) ?? [];
        list.push({ catalogKey, exercise });
        exercisesByDetourKey.set(key, list);
        continue;
      }
    } else if (exercise.lesson?.lesson_name !== lessonName) {
      continue;
    }

    lessonExercises.push({ catalogKey, exercise });
  }

  for (const item of lessonExercises) {
    items.push({ kind: "exercise", ...item });
  }

  for (const detour of detoursForLesson) {
    items.push({
      kind: "detour",
      detourKey: detour.key,
      title: detour.title,
      exercises: exercisesByDetourKey.get(detour.key) ?? [],
    });
  }

  return items;
}
