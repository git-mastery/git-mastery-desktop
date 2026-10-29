import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "../../contexts/ThemeContext";
import { IconButton } from "../ui/IconButton";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <IconButton
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
    </IconButton>
  );
};
