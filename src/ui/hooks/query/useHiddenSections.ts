import { useSiteViewPrefs } from "../useSiteViewPrefs";
import { useCourseEdition } from "./useCourseEdition";
import { useCustardUIConfig } from "./useCustardUIConfig";
import type { LessonOutlineItem } from "../../utils/lessonOutline";

const SECTION_TOGGLES = {
  "hands-on": "hands-on-practicals",
  exercise: "exercises",
  detour: "detours",
} as const;

export type HiddenSections = ReadonlySet<LessonOutlineItem["kind"]>;

export function useHiddenSections(): HiddenSections {
  const prefs = useSiteViewPrefs();
  const { data: config } = useCustardUIConfig();
  const { data: edition } = useCourseEdition(prefs?.adaptationId);
  const hidden = new Set<LessonOutlineItem["kind"]>();

  for (const kind of Object.keys(
    SECTION_TOGGLES,
  ) as LessonOutlineItem["kind"][]) {
    const id = SECTION_TOGGLES[kind];
    const state = prefs?.state;
    // Explicit local choices override the edition preset and site defaults.
    if (state?.shownToggles?.includes(id) || state?.peekToggles?.includes(id))
      continue;
    const preset = edition?.preset?.toggles?.[id];
    const toggle = config?.config?.toggles?.find(
      (item) => item.toggleId === id,
    );
    const fallback =
      preset === "show" || preset === "peek" || preset === "hide"
        ? preset
        : (toggle?.default ?? "show");
    if (state?.hiddenToggles?.includes(id) || fallback === "hide")
      hidden.add(kind);
  }

  return hidden;
}
