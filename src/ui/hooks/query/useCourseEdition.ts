import { useEffect, useState } from "react";
import { SITE_ORIGIN } from "../../contexts/WebContentsViewContext";
import {
  buildAdaptationJsonUrl,
  readDesktopSiteViewPrefs,
  SITE_VIEW_PREFS_CHANGED_EVENT,
} from "../../utils/siteViewPrefs";
import { useCustomQuery } from "./useCustomQuery";

export type RequirementTone = "danger" | "info" | "muted";

export type RequirementLabel = {
  value: string;
  tone: RequirementTone;
};

const LABEL_MAX_CHARS = 24;

export function useAdaptationId(): string | undefined {
  const [id, setId] = useState(() => readDesktopSiteViewPrefs()?.adaptationId);

  useEffect(() => {
    const sync = () => setId(readDesktopSiteViewPrefs()?.adaptationId);
    window.addEventListener(SITE_VIEW_PREFS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SITE_VIEW_PREFS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return id;
}

function toneFromColor(color: unknown): RequirementTone {
  if (color === "r") return "danger";
  if (color === "b") return "info";
  return "muted";
}

/** Returns null when the file is unusable; an empty map when it has no labels. */
export function parseEditionLabels(
  body: unknown,
  expectedId: string,
): Map<string, RequirementLabel> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.id !== expectedId) return null;

  const preset = record.preset;
  if (!preset || typeof preset !== "object") return new Map();
  const labels = (preset as Record<string, unknown>).labels;
  if (!labels || typeof labels !== "object") return new Map();

  const map = new Map<string, RequirementLabel>();
  for (const [key, entry] of Object.entries(labels)) {
    if (!key || typeof entry !== "object" || entry === null) continue;
    const value = (entry as Record<string, unknown>).value;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    map.set(key, {
      value: trimmed.slice(0, LABEL_MAX_CHARS),
      tone: toneFromColor((entry as Record<string, unknown>).color),
    });
  }
  return map;
}

/**
 * Overlay labels for the current course edition. `null` means no overlay
 * (no edition, missing file, or unusable JSON). A Map, even empty, means the
 * edition loaded and chips come only from the file.
 */
export function useCourseEditionLabels() {
  const adaptationId = useAdaptationId();
  return useCustomQuery<Map<string, RequirementLabel> | null>({
    queryKey: ["course-edition", adaptationId ?? ""],
    queryFn: async () => {
      if (!adaptationId) return null;
      try {
        const response = await fetch(
          buildAdaptationJsonUrl(SITE_ORIGIN, adaptationId),
        );
        if (!response.ok) return null;
        const body: unknown = await response.json();
        return parseEditionLabels(body, adaptationId);
      } catch {
        return null;
      }
    },
    options: {
      enabled: Boolean(adaptationId),
      retry: false,
    },
  });
}
