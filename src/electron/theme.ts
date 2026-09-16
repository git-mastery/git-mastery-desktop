import { BrowserWindow, nativeTheme } from "electron";
import { ipcMainOn } from "./utils/util.js";
import { getConfig, saveConfig } from "./storage.js";

export const THEME_BACKGROUND = {
  light: "#ffffff",
  dark: "#212529",
} as const;

let appliedPreference: SitePageTheme = "system";
let appliedResolved: "light" | "dark" = "light";
let backgroundTarget: ((color: string) => void) | null = null;

export function getAppliedResolvedTheme(): "light" | "dark" {
  return appliedResolved;
}

export function registerThemeBackgroundTarget(setter: (color: string) => void) {
  backgroundTarget = setter;
  setter(THEME_BACKGROUND[appliedResolved]);
}

export function resolveFromOs(preference: SitePageTheme): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

export function readStoredThemePreference(): SitePageTheme {
  const theme = getConfig().theme;
  return theme === "light" || theme === "dark" || theme === "system"
    ? theme
    : "system";
}

export function applyAppTheme(
  mainWindow: BrowserWindow,
  preference: SitePageTheme,
  resolved: "light" | "dark" = resolveFromOs(preference),
  persist = false,
) {
  appliedPreference = preference;
  appliedResolved = resolved;
  nativeTheme.themeSource = preference;
  const background = THEME_BACKGROUND[resolved];
  if (!mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(background);
  }
  backgroundTarget?.(background);
  if (persist) saveConfig({ theme: preference });
}

export function setupTheme(mainWindow: BrowserWindow) {
  applyAppTheme(mainWindow, readStoredThemePreference());

  nativeTheme.on("updated", () => {
    if (appliedPreference !== "system") return;
    applyAppTheme(mainWindow, "system");
  });

  ipcMainOn("set-app-theme", ({ preference, resolved }) => {
    applyAppTheme(mainWindow, preference, resolved, true);
  });
}
