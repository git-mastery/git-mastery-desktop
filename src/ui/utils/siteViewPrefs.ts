const DESKTOP_KEY = "site-view-prefs";

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
}

/** CustardUI placeholder for the GitHub username on git-mastery.org. */
export function readStoredGithubUsername(): string | null {
  const value = readDesktopSiteViewPrefs()?.state.placeholders?.username;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@/, "");
  return trimmed || null;
}
