import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext } from "../contexts/ThemeContext";
import {
  applyResolvedTheme,
  persistTheme,
  readStoredThemePreference,
} from "../utils/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SitePageTheme>(readStoredThemePreference);

  useEffect(() => {
    persistTheme(theme);
    applyResolvedTheme(theme);
    window.electron.setAppTheme({ preference: theme, resolved: theme });
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
