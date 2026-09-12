import type { Exercise } from "../../types/Exercise";

export const formatExerciseIdentifier = (identifier: string) =>
  identifier
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

export const formatExerciseTitle = (exercise: Exercise) => {
  if (exercise.detour) {
    return exercise.detour.title;
  }

  return formatExerciseIdentifier(exercise.identifier);
};

export const getExerciseLessonName = (exercise: Exercise) => {
  return exercise.lesson?.lesson_name ?? exercise.detour?.lesson?.lesson_name;
};
