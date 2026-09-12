import { createContext, useContext } from "react";
import type { Exercise } from "../../types/Exercise";
import type { Lesson, Tour } from "../../types/Tour";
import { getExerciseLessonName } from "../utils/format";

export const SITE_ORIGIN = "https://git-mastery.org";
export const LESSONS_HOME_URL = `${SITE_ORIGIN}/lessons/`;

export type WebContentsViewState = {
  currentUrl: string | null;
  navigate: (url: string) => void;
  setEmbeddedVisible: (visible: boolean) => void;
  suppressEmbedded: () => () => void;
};

export const WebContentsViewContext =
  createContext<WebContentsViewState | null>(null);

/**
 * Hook that tracks the current URL displayed in the Electron WebContentsView
 * and exposes a `navigate(url)` function that updates the state and sends
 * an IPC message to tell the main process to load the new URL.
 */
export function useWebContentsView() {
  const context = useContext(WebContentsViewContext);
  if (!context) {
    throw new Error(
      "useWebContentsView must be used within a WebContentsViewProvider",
    );
  }
  return context;
}

export function buildLessonUrl(lesson: Lesson) {
  return `${SITE_ORIGIN}/lessons/${lesson.lesson_name}/`;
}

export function buildTourHomeUrl(tour: Tour) {
  return buildTourHomeUrlFromName(tour.folder);
}

export function buildTourHomeUrlFromName(tourName: string) {
  return `${SITE_ORIGIN}/lessons/trail/${tourName}`;
}

export function isLessonUrlActive(lesson: Lesson, currentUrl: string | null) {
  if (!currentUrl) return false;
  // Trailing "/" on buildLessonUrl is a safe prefix boundary (including hashes).
  return currentUrl.startsWith(buildLessonUrl(lesson));
}

export function isTourHomeUrlActive(tour: Tour, currentUrl: string | null) {
  if (!currentUrl) return false;
  const base = buildTourHomeUrl(tour);
  return currentUrl === base || currentUrl.startsWith(`${base}/`);
}

export function isTourUrlActive(tour: Tour, currentUrl: string | null) {
  if (isTourHomeUrlActive(tour, currentUrl)) return true;
  return Object.values(tour.lessons).some((lesson) =>
    isLessonUrlActive(lesson, currentUrl),
  );
}

export function buildExerciseUrl(exercise: Exercise) {
  const lessonName = getExerciseLessonName(exercise);
  if (!lessonName) {
    return SITE_ORIGIN;
  }

  return `${SITE_ORIGIN}/lessons/${lessonName}/#exercise-${exercise.identifier}`;
}

export function buildHandsOnUrl(lesson: Lesson, identifier: string) {
  return `${SITE_ORIGIN}/lessons/${lesson.lesson_name}/#hands-on-${identifier}`;
}
