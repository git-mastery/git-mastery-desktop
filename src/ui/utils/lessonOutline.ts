import type { Detours } from "../../types/Detour";
import type { Exercise, Exercises } from "../../types/Exercise";
import type { LessonMarker } from "./lessonMarkers";

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

const indexLessonCatalog = (
  lessonName: string,
  exercises: Exercises | undefined,
  detours: Detours | undefined,
) => {
  const detoursForLesson: { key: string; title: string }[] = [];
  const detourByKey = new Map<string, { key: string; title: string }>();
  const detourKeyByIdentity = new Map<string, string>();
  for (const [key, detour] of Object.entries(detours ?? {})) {
    if (detour.lesson.lesson_name !== lessonName) continue;
    const entry = { key, title: detour.title };
    detoursForLesson.push(entry);
    detourByKey.set(key, entry);
    detourKeyByIdentity.set(detourIdentity(lessonName, detour.title), key);
  }

  const lessonExercises: CataloguedExercise[] = [];
  const lessonExerciseByKey = new Map<string, CataloguedExercise>();
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
      }
      continue;
    } else if (exercise.lesson?.lesson_name !== lessonName) {
      continue;
    }

    const item = { catalogKey, exercise };
    lessonExercises.push(item);
    lessonExerciseByKey.set(catalogKey, item);
  }

  return {
    detoursForLesson,
    detourByKey,
    lessonExercises,
    lessonExerciseByKey,
    exercisesByDetourKey,
  };
};

const handsOnItem = (marker: Extract<LessonMarker, { kind: "hands-on" }>) => ({
  kind: "hands-on" as const,
  identifier: marker.identifier,
  title: marker.title,
  panelId: marker.panelId ?? `hands-on-${marker.identifier}`,
});

const detourItem = (
  detour: { key: string; title: string },
  exercisesByDetourKey: Map<string, CataloguedExercise[]>,
): LessonOutlineDetour => ({
  kind: "detour",
  detourKey: detour.key,
  title: detour.title,
  exercises: exercisesByDetourKey.get(detour.key) ?? [],
});

/**
 * Ordered contents of one lesson. When `text.md` markers are available they
 * set the row order; unmatched catalog exercises and detours are appended in
 * JSON key order. Hands-on rows come only from markers.
 *
 * Exercises with a `detour` nest under that detour rather than listing as
 * lesson exercises. `wip` exercises are omitted.
 */
export function buildLessonOutline(
  lessonName: string,
  exercises: Exercises | undefined,
  detours: Detours | undefined,
  markers: LessonMarker[] | undefined,
): LessonOutlineItem[] {
  const {
    detoursForLesson,
    detourByKey,
    lessonExercises,
    lessonExerciseByKey,
    exercisesByDetourKey,
  } = indexLessonCatalog(lessonName, exercises, detours);

  const items: LessonOutlineItem[] = [];
  const usedExerciseKeys = new Set<string>();
  const usedDetourKeys = new Set<string>();

  for (const marker of markers ?? []) {
    if (marker.kind === "hands-on") {
      items.push(handsOnItem(marker));
      continue;
    }

    if (marker.kind === "exercise") {
      const found = lessonExerciseByKey.get(marker.catalogKey);
      if (!found || usedExerciseKeys.has(marker.catalogKey)) continue;
      usedExerciseKeys.add(marker.catalogKey);
      items.push({ kind: "exercise", ...found });
      continue;
    }

    const detour = detourByKey.get(marker.detourKey);
    if (!detour || usedDetourKeys.has(marker.detourKey)) continue;
    usedDetourKeys.add(marker.detourKey);
    items.push(detourItem(detour, exercisesByDetourKey));
  }

  for (const item of lessonExercises) {
    if (usedExerciseKeys.has(item.catalogKey)) continue;
    items.push({ kind: "exercise", ...item });
  }

  for (const detour of detoursForLesson) {
    if (usedDetourKeys.has(detour.key)) continue;
    items.push(detourItem(detour, exercisesByDetourKey));
  }

  return items;
}
