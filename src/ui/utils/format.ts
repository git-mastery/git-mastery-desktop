import type { Exercise } from "../../types/Exercise";

/** Matches the CLI / folder prefix for hands-on practicals (`hp-init-repo`). */
export const HANDS_ON_PREFIX = "hp-";

export const isHandsOnIdentifier = (identifier: string) =>
  identifier.startsWith(HANDS_ON_PREFIX);

export const formatExerciseIdentifier = (identifier: string) =>
  identifier
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

export const formatHandsOnTitle = (identifier: string) =>
  formatExerciseIdentifier(
    isHandsOnIdentifier(identifier)
      ? identifier.slice(HANDS_ON_PREFIX.length)
      : identifier,
  );

export const formatExerciseTitle = (exercise: Exercise) => {
  if (exercise.detour) {
    return exercise.detour.title;
  }

  return formatExerciseIdentifier(exercise.identifier);
};

export const getExerciseLessonName = (exercise: Exercise) => {
  return exercise.lesson?.lesson_name ?? exercise.detour?.lesson?.lesson_name;
};
