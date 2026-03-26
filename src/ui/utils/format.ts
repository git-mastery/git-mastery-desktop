import type { Exercise } from "../../types/Exercise";

/**
 * Formats a breadcrumb string to be more readable.
 * 
 * Input strings are camelCase. Add a space before each character
 * @param s 
 */
export const formatBreadcrumb = (s: string) => {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}

export const formatExerciseTitle = (exercise: Exercise) => {
  if (exercise.detour) {
    return exercise.detour.title
  }
  if (exercise.lesson) {
    // remove the TXLX.
    return exercise.identifier.replace(/^T\d+L\d+\. /, "")
  }

  return exercise.identifier.split("-").map((s) => s.toUpperCase()).join(" ")

}