import { SITE_ORIGIN } from "../../contexts/WebContentsViewContext";
import { useCustomQuery } from "./useCustomQuery";

export type ToggleMode = "show" | "peek" | "hide";

export type CustardUIPlaceholder = {
  name: string;
  siteManaged?: boolean;
  settingsLabel?: string;
  settingsHint?: string;
};

export type CustardUIToggle = {
  toggleId: string;
  label: string;
  default?: ToggleMode;
  description?: string;
};

export type CustardUITab = {
  tabId: string;
  label: string;
  placeholderValue?: string;
};

export type CustardUITabGroup = {
  groupId: string;
  label: string;
  default?: string;
  placeholderId?: string;
  tabs: CustardUITab[];
};

export type CustardUIConfigFile = {
  storageKey?: string;
  config?: {
    placeholders?: CustardUIPlaceholder[];
    toggles?: CustardUIToggle[];
    tabGroups?: CustardUITabGroup[];
  };
};

export const CUSTARDUI_CONFIG_URL = `${SITE_ORIGIN}/custardui.config.json`;

export const useCustardUIConfig = () =>
  useCustomQuery<CustardUIConfigFile>({
    queryKey: ["custardui-config"],
    queryUrl: CUSTARDUI_CONFIG_URL,
  });
