import { app } from "electron";
import path from "path";
import fs from "fs";

export type StoredAiProvider = {
  model?: string;
  baseUrl?: string;
  /** Encrypted with Electron safeStorage, as base64. */
  apiKeyEnc?: string;
  /** Plaintext fallback when safeStorage encryption is unavailable. */
  apiKeyPlain?: string;
};

interface Config {
  /**
   * The Git-Mastery exercises root the learner created with `gitmastery setup`.
   * This is the folder itself (the one containing `.gitmastery.json`), not its parent.
   */
  exercisesRoot?: string;
  /** The learner has seen the first-Start introduction. */
  startIntroSeen?: boolean;
  /** Desktop + site colour preference. System follows the OS. */
  theme?: SitePageTheme;
  /** Parent folder chosen by older builds. Migrated to `exercisesRoot` on read. */
  dataDirectory?: string;
  /** AI hints: the chosen provider, and each provider's own key and model. */
  ai?: {
    provider?: AiProviderId;
    providers?: Partial<Record<AiProviderId, StoredAiProvider>>;
  };
}

const appBasePath = app.getPath("userData");
const configPath = path.join(app.getPath("userData"), "config.json");

export const getUserStoragePath = () => appBasePath;

const readConfigFile = (): Config => {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as Config;
};

const writeConfigFile = (config: Config): void => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
};

export function getConfig(): Config {
  try {
    const config = readConfigFile();
    if (config.exercisesRoot || !config.dataDirectory) return config;

    const legacyRoot = path.join(config.dataDirectory, "gitmastery-exercises");
    if (!fs.existsSync(legacyRoot)) return config;

    const migrated: Config = { ...config, exercisesRoot: legacyRoot };
    delete migrated.dataDirectory;
    writeConfigFile(migrated);
    return migrated;
  } catch {
    return {};
  }
}

/** Forgets the linked exercises folder. Does not delete anything on disk. */
export function clearExerciseRoot(): void {
  try {
    const config = readConfigFile();
    delete config.exercisesRoot;
    // Drop the legacy parent too, or the next read would link that folder again.
    delete config.dataDirectory;
    writeConfigFile(config);
  } catch (err) {
    console.error("Failed to write config:", err);
  }
}

export function saveConfig(partial: Partial<Config>): void {
  try {
    const merged = { ...getConfig(), ...partial };
    writeConfigFile(merged);
  } catch (err) {
    console.error("Failed to write config:", err);
  }
}
