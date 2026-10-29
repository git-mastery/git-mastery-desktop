import { IconHelp } from "@tabler/icons-react";
import { IconButton } from "../ui/IconButton";
import { SettingsMenu } from "./SettingsMenu";
import { SiteNav } from "./SiteNav";
import { ThemeToggle } from "./ThemeToggle";

export const Header = ({ onHelp }: { onHelp: () => void }) => {
  return (
    <div className="flex h-full items-center justify-between">
      <SiteNav />
      <div className="flex items-center gap-1">
        <IconButton aria-label="Help" onClick={onHelp}>
          <IconHelp size={18} />
        </IconButton>
        <ThemeToggle />
        <SettingsMenu />
      </div>
    </div>
  );
};
