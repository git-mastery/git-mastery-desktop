import { createContext, useContext } from "react";

export type ThemeContextValue = {
  theme: SitePageTheme;
  setTheme: (theme: SitePageTheme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
