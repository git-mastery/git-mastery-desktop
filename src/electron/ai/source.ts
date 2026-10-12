import { HANDS_ON_PREFIX, isPathSegment } from "../exerciseManifest.js";

export function workspaceKindOf(id: string): "exercise" | "hands-on" {
  return id.startsWith(HANDS_ON_PREFIX) ? "hands-on" : "exercise";
}

export function fallbackWorkspaceTitle(id: string): string {
  if (workspaceKindOf(id) === "exercise") return id;
  const words = id.slice(HANDS_ON_PREFIX.length).split("-");
  const text = words.filter(Boolean).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function workspaceSource(id: string, title?: string): AiSource {
  if (workspaceKindOf(id) === "hands-on") {
    return {
      sourceKey: `hands-on:${id}`,
      kind: "hands-on",
      id,
      title: title || fallbackWorkspaceTitle(id),
    };
  }
  return {
    sourceKey: `exercise:${id}`,
    kind: "exercise",
    id,
    title: title || id,
  };
}

export function lessonSource(id: string, title?: string): AiSource {
  return {
    sourceKey: `lesson:${id}`,
    kind: "lesson",
    id,
    title: title || id,
  };
}

export function parseAiSource(value: unknown): AiSource | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const { kind, id, title } = record;
  if (typeof id !== "string" || !isPathSegment(id)) return null;
  if (typeof title !== "string") return null;
  if (kind === "lesson" && record.sourceKey === `lesson:${id}`) {
    return lessonSource(id, title);
  }
  if (
    kind === "exercise" &&
    record.sourceKey === `exercise:${id}` &&
    workspaceKindOf(id) === "exercise"
  ) {
    return workspaceSource(id, title);
  }
  if (
    kind === "hands-on" &&
    record.sourceKey === `hands-on:${id}` &&
    workspaceKindOf(id) === "hands-on"
  ) {
    return workspaceSource(id, title);
  }
  return null;
}

/** Lesson folder from a lesson page URL, or null for trail / home / other pages. */
export function parseLessonNameFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
      .replace(/\/index\.html$/, "")
      .replace(/\/$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== "lessons") return null;
    if (parts[1] === "trail") return null;
    return isPathSegment(parts[1]) ? parts[1] : null;
  } catch {
    return null;
  }
}

/**
 * Prompt encoded in a git-mastery.org ChatGPT link, or null when the URL is
 * not the exact `https://chatgpt.com/?q=…` shape the lessons use.
 */
export function parseChatGptQuery(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "chatgpt.com") return null;
    if (parsed.pathname !== "/") return null;
    const query = parsed.searchParams.get("q")?.trim();
    return query || null;
  } catch {
    return null;
  }
}
