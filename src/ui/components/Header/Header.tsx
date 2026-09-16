import { SettingsMenu } from "./SettingsMenu";
import { SiteNav } from "./SiteNav";

export const Header = () => {
  return (
    <div className="flex h-full items-center justify-between">
      <SiteNav />
      <SettingsMenu />
    </div>
  );
};
