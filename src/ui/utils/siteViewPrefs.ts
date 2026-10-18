const DESKTOP_KEY = "site-view-prefs";

/** Same-tab signal after Settings writes `site-view-prefs`. */
export const SITE_VIEW_PREFS_CHANGED_EVENT = "gm-site-view-prefs";

/** CustardUI adaptation ids are path segments of `/versions/<id>/<id>.json`. */
export const ADAPTATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,64}$/;

export function normalizeAdaptationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return ADAPTATION_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function buildAdaptationJsonUrl(origin: string, id: string) {
  const encoded = encodeURIComponent(id);
  return `${origin}/versions/${encoded}/${encoded}.json`;
}

export function readDesktopSiteViewPrefs(): SiteViewPrefs | null {
  try {
    const raw = window.localStorage.getItem(DESKTOP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteViewPrefs;
    if (!parsed || typeof parsed !== "object" || !parsed.state) return null;
    return {
      state: parsed.state,
      tabNavsVisible: parsed.tabNavsVisible !== false,
      theme:
        parsed.theme === "dark" ||
        parsed.theme === "light" ||
        parsed.theme === "system"
          ? parsed.theme
          : undefined,
      adaptationId: normalizeAdaptationId(parsed.adaptationId),
    };
  } catch {
    return null;
  }
}

export function writeDesktopSiteViewPrefs(prefs: SiteViewPrefs) {
  try {
    window.localStorage.setItem(DESKTOP_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable or full; the in-memory form still applies.
  }
  window.dispatchEvent(new Event(SITE_VIEW_PREFS_CHANGED_EVENT));
}

/** CustardUI placeholder for the GitHub username on git-mastery.org. */
export function readStoredGithubUsername(): string | null {
  const value = readDesktopSiteViewPrefs()?.state.placeholders?.username;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@/, "");
  return trimmed || null;
}
