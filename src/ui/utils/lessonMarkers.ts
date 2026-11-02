import { formatHandsOnTitle } from "./format";

export type LessonMarkerHandsOn = {
  kind: "hands-on";
  identifier: string;
  title: string;
  panelId: string | null;
};

export type LessonMarkerExercise = {
  kind: "exercise";
  catalogKey: string;
};

export type LessonMarkerDetour = {
  kind: "detour";
  detourKey: string;
};

export type LessonMarker =
  LessonMarkerHandsOn | LessonMarkerExercise | LessonMarkerDetour;

type LocatedMarker = {
  index: number;
  marker: LessonMarker;
};

const hopTitleRe = () => /show_hands_on_practical\(\s*(['"])(.*?)\1/gs;
const hopPrepRe = () => /show_hop_prep\(\s*['"](hp-[a-z0-9-]+)['"]/gs;
const exerciseRe = () => /show_exercise\(\s*exercises\.([A-Za-z0-9_]+)/gs;
const detourRe = () => /show_detour\(\s*(['"])([^'"]+)\1/gs;

const lessonBody = (markdown: string): string => {
  const newline = markdown.indexOf("\n");
  const firstLine = newline === -1 ? markdown : markdown.slice(0, newline);
  if (/\{%\s*from\b/.test(firstLine)) {
    return newline === -1 ? "" : markdown.slice(newline + 1);
  }
  return markdown;
};

/**
 * Ordered hands-on, exercise, and detour markers from a lesson `text.md`.
 * `show_detour_preview` is ignored. Repeated hop identifiers keep the first
 * occurrence so the sidebar reorders existing rows instead of duplicating them.
 */
export function parseLessonMarkers(markdown: string): LessonMarker[] {
  const text = lessonBody(markdown);
  const located: LocatedMarker[] = [];

  const titles: { index: number; title: string }[] = [];
  for (const match of text.matchAll(hopTitleRe())) {
    titles.push({ index: match.index ?? 0, title: match[2] });
  }

  const seenHops = new Set<string>();
  for (const match of text.matchAll(hopPrepRe())) {
    const identifier = match[1];
    if (seenHops.has(identifier)) continue;
    seenHops.add(identifier);

    const index = match.index ?? 0;
    let panelId: string | null = null;
    for (const entry of titles) {
      if (entry.index < index) panelId = entry.title;
      else break;
    }

    located.push({
      index,
      marker: {
        kind: "hands-on",
        identifier,
        title: panelId ?? formatHandsOnTitle(identifier),
        panelId,
      },
    });
  }

  const seenExercises = new Set<string>();
  for (const match of text.matchAll(exerciseRe())) {
    const catalogKey = match[1];
    if (seenExercises.has(catalogKey)) continue;
    seenExercises.add(catalogKey);
    located.push({
      index: match.index ?? 0,
      marker: { kind: "exercise", catalogKey },
    });
  }

  const seenDetours = new Set<string>();
  for (const match of text.matchAll(detourRe())) {
    const detourKey = match[2];
    if (seenDetours.has(detourKey)) continue;
    seenDetours.add(detourKey);
    located.push({
      index: match.index ?? 0,
      marker: { kind: "detour", detourKey },
    });
  }

  located.sort((left, right) => left.index - right.index);
  return located.map((item) => item.marker);
}
