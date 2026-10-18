import { formatHandsOnTitle } from "../../utils/format";
import { useCustomQuery } from "./useCustomQuery";

export type HandsOn = {
  identifier: string;
  lessonName: string;
  /** Display title from `show_hands_on_practical`, or a formatted identifier. */
  title: string;
  /** Page `id` on `.gm-hands-on-practical`, when a practical title was found. */
  panelId: string | null;
};

export type HandsOnByLesson = {
  [lessonName: string]: HandsOn[];
};

const TEXT_MD_URL = (lessonName: string) =>
  `https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/lessons/${lessonName}/text.md`;

const HOP_PREP_RE = /show_hop_prep\(\s*['"](hp-[a-z0-9-]+)['"]/g;
const HOP_TITLE_RE = /show_hands_on_practical\(\s*(['"])(.*?)\1/g;

export const parseHandsOn = (
  markdown: string,
  lessonName: string,
): HandsOn[] => {
  const titles: { index: number; title: string }[] = [];
  for (const match of markdown.matchAll(HOP_TITLE_RE)) {
    titles.push({ index: match.index ?? 0, title: match[2] });
  }

  const result: HandsOn[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(HOP_PREP_RE)) {
    const identifier = match[1];
    if (seen.has(identifier)) continue;
    seen.add(identifier);

    const idx = match.index ?? 0;
    let panelId: string | null = null;
    for (const entry of titles) {
      if (entry.index < idx) panelId = entry.title;
      else break;
    }

    result.push({
      identifier,
      lessonName,
      title: panelId ?? formatHandsOnTitle(identifier),
      panelId,
    });
  }
  return result;
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
  return parseHandsOn(await response.text(), lessonName);
};

/**
 * Hands-on practicals are not in exercises.json. They are declared in each
 * lesson's text.md as `show_hop_prep('hp-…')` inside a
 * `show_hands_on_practical("…")` block.
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
