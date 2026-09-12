import { useCustomQuery } from "./useCustomQuery";

export type HandsOn = {
  identifier: string;
  lessonName: string;
};

export type HandsOnByLesson = {
  [lessonName: string]: HandsOn[];
};

const TEXT_MD_URL = (lessonName: string) =>
  `https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/lessons/${lessonName}/text.md`;

const HOP_PREP_RE = /show_hop_prep\(\s*['"](hp-[a-z0-9-]+)['"]/g;

const parseHandsOnIds = (markdown: string): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(HOP_PREP_RE)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

const fetchHandsOnForLesson = async (
  lessonName: string,
): Promise<HandsOn[]> => {
  const response = await fetch(TEXT_MD_URL(lessonName));
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(
      `Request to ${TEXT_MD_URL(lessonName)} failed with ${response.status}`,
    );
  }
  const ids = parseHandsOnIds(await response.text());
  return ids.map((identifier) => ({ identifier, lessonName }));
};

/**
 * Hands-on practicals are not in exercises.json. They are declared in each
 * lesson's text.md as `show_hop_prep('hp-…')`.
 */
export const useHandsOn = (lessonNames: string[]) => {
  const namesKey = lessonNames.join(",");
  return useCustomQuery<HandsOnByLesson>({
    queryKey: ["hands-on", namesKey],
    queryFn: async () => {
      const entries = await Promise.all(
        lessonNames.map(async (lessonName) => {
          try {
            return [
              lessonName,
              await fetchHandsOnForLesson(lessonName),
            ] as const;
          } catch (err) {
            console.warn(`[hands-on] failed to catalog ${lessonName}:`, err);
            return [lessonName, []] as const;
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
