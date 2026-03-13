import { app } from 'electron';
import path from 'path';
import fs from 'fs';

interface Config {
  exeLocation?: string;
  exerciseDirectory?: string;
}

const configPath = path.join(app.getPath('userData'), 'config.json');

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
