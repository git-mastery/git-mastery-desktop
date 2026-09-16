import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import {
  applyResolvedTheme,
  prefersDark,
  readStoredThemePreference,
  resolveTheme,
} from "../utils/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<SitePageTheme>(
    readStoredThemePreference,
  );
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyResolvedTheme(resolved);
    window.electron.setAppTheme({ preference, resolved });
  }, [preference, resolved]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
