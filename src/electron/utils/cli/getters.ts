import path from "path";
import { getConfig } from "../../storage.js";

// Helper function to get the correct gitmastery executable based on platform
export function getGitMasteryExecutable(): string {
  if (process.platform === 'darwin') {
    return "gitmastery";
  }

  // TODO(linux)
  if (process.platform === "linux") {
    return path.join(getConfig().dataDirectory!, "gitmastery");
  }

  // on Windows
  return path.join(getConfig().dataDirectory!, "gitmastery.exe");

  // if (getConfig().exeLocation) {
  //   return getConfig().exeLocation!;
  // }

  // if (process.platform === 'darwin') {
  //   // On macOS, use Homebrew-installed gitmastery
  //   return 'gitmastery';
  // } else {
  //   // On Windows, use bundled executable
  //   return path.join(__dirname, '../gitmastery.exe');
  // }
}

// Helper function to get environment with Homebrew paths added
export function getEnvironmentWithHomebrew(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  if (process.platform === 'darwin') {
    // On macOS, add common Homebrew paths to PATH
    const homebrewPaths = [
      '/opt/homebrew/bin',      // Apple Silicon Macs
      '/usr/local/bin',         // Intel Macs
      '/opt/homebrew/sbin',
      '/usr/local/sbin'
    ];

    // Standard system paths that should always be included
    const systemPaths = [
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ];

    // Get current PATH or use system paths as fallback
    const currentPath = env.PATH || systemPaths.join(':');

    // Combine Homebrew paths with current PATH
    // Put Homebrew paths first so they take precedence
    const allPaths = [...homebrewPaths, ...currentPath.split(':')];

    // Remove duplicates while preserving order
    const uniquePaths = Array.from(new Set(allPaths)).filter(p => p.length > 0);

    env.PATH = uniquePaths.join(':');

    // Debug logging to help diagnose PATH issues
    console.log('Enhanced PATH for macOS:', env.PATH);
  }

  return env;
}

export function getExerciseDirectory(): string {
  const dataDirectory = getConfig().dataDirectory;
  if (!dataDirectory) {
    throw new Error('Exercise directory not found, please configure them in settings.');
  }
  return path.join(dataDirectory, "gitmastery-exercises");
}