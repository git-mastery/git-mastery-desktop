import { createContext, useContext } from "react";
import type { ResolvedTheme } from "../utils/theme";

export type ThemeContextValue = {
  preference: SitePageTheme;
  resolved: ResolvedTheme;
  setPreference: (theme: SitePageTheme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
