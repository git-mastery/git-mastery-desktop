export type ResolvedTheme = SitePageTheme;

const THEME_KEY = "gm-theme";
const LEGACY_PREFS_KEY = "site-view-prefs";

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function parseTheme(value: unknown): SitePageTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

function resolveFromOs(): SitePageTheme {
  return prefersDark() ? "dark" : "light";
}

function stripLegacyThemeFromSitePrefs() {
  try {
    const raw = window.localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { theme?: unknown } & Record<
      string,
      unknown
    >;
    if (!parsed || typeof parsed !== "object" || !("theme" in parsed)) return;
    delete parsed.theme;
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify(parsed));
  } catch {
    // Storage can be unavailable or the blob can be malformed.
  }
}

function readLegacyThemeFromSitePrefs(): SitePageTheme | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return parseTheme(parsed?.theme);
  } catch {
    return null;
  }
}

export function persistTheme(theme: SitePageTheme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable or full; in-memory state still applies.
  }
}

/** Missing or legacy `"system"` values resolve from the OS once and are persisted. */
export function readStoredThemePreference(): SitePageTheme {
  try {
    const stored = parseTheme(window.localStorage.getItem(THEME_KEY));
    if (stored) {
      stripLegacyThemeFromSitePrefs();
      return stored;
    }
    const legacy = readLegacyThemeFromSitePrefs();
    const resolved = legacy ?? resolveFromOs();
    persistTheme(resolved);
    stripLegacyThemeFromSitePrefs();
    return resolved;
  } catch {
    // Storage can be unavailable or the blob can be malformed.
  }
  const resolved = resolveFromOs();
  persistTheme(resolved);
  return resolved;
}

export function applyResolvedTheme(theme: SitePageTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
