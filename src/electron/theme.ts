import { BrowserWindow, nativeTheme } from "electron";
import { ipcMainOn } from "./utils/util.js";
import { getConfig, saveConfig } from "./storage.js";

export const THEME_BACKGROUND = {
  light: "#ffffff",
  dark: "#212529",
} as const;

let appliedTheme: SitePageTheme = "light";
let backgroundTarget: ((color: string) => void) | null = null;
let pageThemeTarget: ((theme: SitePageTheme, reload: boolean) => void) | null =
  null;

export function getAppliedResolvedTheme(): SitePageTheme {
  return appliedTheme;
}

export function registerThemeBackgroundTarget(setter: (color: string) => void) {
  backgroundTarget = setter;
  setter(THEME_BACKGROUND[appliedTheme]);
}

export function registerThemePageTarget(
  setter: (theme: SitePageTheme, reload: boolean) => void,
) {
  pageThemeTarget = setter;
  setter(appliedTheme, false);
}

export function resolveFromOs(): SitePageTheme {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

/** Missing or legacy `"system"` values resolve from the OS once and are persisted. */
export function readStoredThemePreference(): SitePageTheme {
  const theme = getConfig().theme;
  if (theme === "light" || theme === "dark") return theme;
  const resolved = resolveFromOs();
  saveConfig({ theme: resolved });
  return resolved;
}

export function applyAppTheme(
  mainWindow: BrowserWindow,
  theme: SitePageTheme,
  persist = false,
) {
  if (theme !== "light" && theme !== "dark") {
    console.warn("[theme] ignored invalid theme value:", theme);
    return;
  }
  const changed = theme !== appliedTheme;
  appliedTheme = theme;
  nativeTheme.themeSource = theme;
  const background = THEME_BACKGROUND[theme];
  if (!mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(background);
  }
  backgroundTarget?.(background);
  pageThemeTarget?.(theme, persist && changed);
  if (persist) saveConfig({ theme });
}

export function setupTheme(
  mainWindow: BrowserWindow,
  theme = readStoredThemePreference(),
) {
  applyAppTheme(mainWindow, theme);

  ipcMainOn("set-app-theme", (payload) => {
    // Keep the original `{ preference, resolved }` IPC contract. The `theme`
    // branch tolerates a renderer left open during development while this
    // binary-only migration was being introduced.
    const next = "theme" in payload ? payload.theme : payload.resolved;
    applyAppTheme(mainWindow, next, true);
  });
}
