import {
  parseLessonMarkers,
  type LessonMarker,
} from "../../utils/lessonMarkers";
import { useCustomQuery } from "./useCustomQuery";

export type LessonMarkersByLesson = {
  [lessonName: string]: LessonMarker[] | undefined;
};

const TEXT_MD_URL = (lessonName: string) =>
  `https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/lessons/${lessonName}/text.md`;

const fetchMarkersForLesson = async (
  lessonName: string,
): Promise<LessonMarker[]> => {
  const response = await fetch(TEXT_MD_URL(lessonName));
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(
      `Request to ${TEXT_MD_URL(lessonName)} failed with ${response.status}`,
    );
  }
  return parseLessonMarkers(await response.text());
};

/**
 * Lesson `text.md` markers (hands-on, exercises, detours) in source order.
 * One fetch per lesson, shared by the tours sidebar outline.
 */
export const useLessonSource = (lessonNames: string[]) => {
  const namesKey = lessonNames.join(",");
  return useCustomQuery<LessonMarkersByLesson>({
    queryKey: ["lesson-source", namesKey],
    queryFn: async () => {
      const entries = await Promise.all(
        lessonNames.map(async (lessonName) => {
          try {
            return [
              lessonName,
              await fetchMarkersForLesson(lessonName),
            ] as const;
          } catch (err) {
            console.warn(
              `[lesson-source] failed to catalog ${lessonName}:`,
              err,
            );
            return [lessonName, undefined] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    options: {
      enabled: lessonNames.length > 0,
    },
  });
};
