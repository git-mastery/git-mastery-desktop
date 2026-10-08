import { isRestorableSiteUrl } from "../contexts/WebContentsViewContext";

const KEY = "gm-last-embedded-url";

export function readLastEmbeddedUrl(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw || !isRestorableSiteUrl(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeLastEmbeddedUrl(url: string): void {
  if (!isRestorableSiteUrl(url)) return;
  try {
    window.localStorage.setItem(KEY, url);
  } catch {
    // Storage can be unavailable or full; the in-memory URL still applies.
  }
}
