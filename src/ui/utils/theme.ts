export type ResolvedTheme = "light" | "dark";

const PREFS_KEY = "site-view-prefs";

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readStoredThemePreference(): SitePageTheme {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return "system";
    const parsed = JSON.parse(raw) as SiteViewPrefs;
    if (
      parsed?.theme === "light" ||
      parsed.theme === "dark" ||
      parsed.theme === "system"
    ) {
      return parsed.theme;
    }
  } catch {
    // Storage can be unavailable or the blob can be malformed.
  }
  return "system";
}

export function resolveTheme(
  preference: SitePageTheme,
  systemDark = prefersDark(),
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemDark ? "dark" : "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
