import { useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconFolder,
  IconSettings,
} from "@tabler/icons-react";
import { ExerciseFolderPanel } from "../Setup/ExerciseFolderPanel";
import { SiteViewPanel } from "./SiteViewPanel";
import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem, MenuLabel } from "../ui/Menu";
import { Modal } from "../ui/Modal";

type SettingsPanel = "exercise-folder" | "site-view";

const PANEL_TITLES: Record<SettingsPanel, string> = {
  "exercise-folder": "Exercise folder",
  "site-view": "Customise UI",
};

export const SettingsMenu = () => {
  const [panel, setPanel] = useState<SettingsPanel | null>(null);
  const opened = panel !== null;

  return (
    <>
      <Menu
        trigger={(props) => (
          <IconButton aria-label="Settings" {...props}>
            <IconSettings size={18} />
          </IconButton>
        )}
      >
        <MenuLabel>Setup</MenuLabel>
        <MenuItem
          icon={<IconFolder size={14} />}
          onClick={() => setPanel("exercise-folder")}
        >
          {PANEL_TITLES["exercise-folder"]}
        </MenuItem>
        <MenuItem
          icon={<IconAdjustmentsHorizontal size={14} />}
          onClick={() => setPanel("site-view")}
        >
          {PANEL_TITLES["site-view"]}
        </MenuItem>
      </Menu>

      <Modal
        opened={opened}
        onClose={() => setPanel(null)}
        title={panel ? PANEL_TITLES[panel] : undefined}
        size="lg"
      >
        {panel === "exercise-folder" && (
          <ExerciseFolderPanel onOpenGuide={() => setPanel(null)} />
        )}
        {panel === "site-view" && (
          <SiteViewPanel onClose={() => setPanel(null)} />
        )}
      </Modal>
    </>
  );
};
