import { app } from 'electron';
import path from 'path';
import fs from 'fs';

interface Config {
  // exeLocation?: string;
  // This is where the exercises are downloaded to. The exercises themselves live under ${dataDirectory}/gitmastery-exercises/
  dataDirectory?: string;
}

const appBasePath = app.getPath('userData');
const configPath = path.join(app.getPath('userData'), 'config.json');

export const getUserStoragePath = () => appBasePath;

export function getConfig(): Config {
  try {
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(partial: Partial<Config>): void {
  try {
    const merged = { ...getConfig(), ...partial };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write config:', err);
  }
}
