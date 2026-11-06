import { useEffect, useState } from "react";
import {
  readDesktopSiteViewPrefs,
  SITE_VIEW_PREFS_CHANGED_EVENT,
} from "../utils/siteViewPrefs";

/** Follow saved Customise choices, including older page-only preferences. */
export function useSiteViewPrefs() {
  const [prefs, setPrefs] = useState(readDesktopSiteViewPrefs);

  useEffect(() => {
    let revision = 0;
    const sync = () => {
      const current = ++revision;
      const desktop = readDesktopSiteViewPrefs();
      setPrefs(desktop);
      if (!desktop) {
        void window.electron
          .getSitePrefs()
          .then((page) => {
            if (current === revision) setPrefs(page);
          })
          .catch(() => {
            // Keep config defaults when the lesson page is unavailable.
          });
      }
    };
    window.addEventListener(SITE_VIEW_PREFS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    const unsubscribeLoading = window.electron.onWcvLoading((loading) => {
      if (!loading && !readDesktopSiteViewPrefs()) sync();
    });
    sync();
    return () => {
      revision++;
      unsubscribeLoading();
      window.removeEventListener(SITE_VIEW_PREFS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return prefs;
}
