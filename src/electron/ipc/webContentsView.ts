import { WebContentsView, BrowserWindow, screen } from "electron";
import { ipcMainHandle, ipcMainOn } from "../utils/util.js";
import { getWcvPreloadPath } from "../pathResolver.js";
import { startExercise, _verify } from "./gitmastery.js";
import { getMainWindow } from "../main.js";
import { sendToRenderer } from "./ipcUtils.js";
import {
  getAppliedResolvedTheme,
  registerThemeBackgroundTarget,
  THEME_BACKGROUND,
} from "../theme.js";

const EMBED_CSS = `
  header .navbar,
  header nav.navbar,
  footer {
    display: none !important;
  }
  #flex-body > #site-nav,
  #page-nav,
  .toggle-page-nav-button,
  .lower-navbar-container,
  .toggle-site-nav-button {
    display: none !important;
  }
  .fixed-header-padding {
    padding-top: 0 !important;
  }
  /* CustardUI settings gear + intro callout — owned by desktop Settings. */
  .cv-settings-icon,
  .cv-callout-wrapper {
    display: none !important;
  }
`;

let wcv: WebContentsView | null = null;

let isHidden = true;
let isLoading = false;
let bounds = { x: 0, y: 0, width: 0, height: 0 };

/** CustardUI localStorage keys on git-mastery.org (`storageKey: "git-mastery"`). */
const SITE_STATE_KEY = "git-mastery-custardUI-state";
const SITE_TAB_NAV_KEY = "git-mastery-cv-tab-navs-visible";
/** MarkBind DarkModeToggle / theme-manager.js */
const SITE_THEME_KEY = "markbind-theme";

/** Latest desktop-owned prefs. Null means do not override the site's localStorage. */
let sitePrefs: SiteViewPrefs | null = null;

function hasLoadedPage() {
  const url = wcv?.webContents.getURL();
  return Boolean(url && url !== "about:blank");
}

function writeSitePrefsScript(prefs: SiteViewPrefs) {
  const themeWrite =
    prefs.theme === "light" || prefs.theme === "dark"
      ? `localStorage.setItem(${JSON.stringify(SITE_THEME_KEY)}, ${JSON.stringify(prefs.theme)});`
      : prefs.theme === "system"
        ? `localStorage.removeItem(${JSON.stringify(SITE_THEME_KEY)});`
        : "";

  return `(function () {
    try {
      localStorage.setItem(${JSON.stringify(SITE_STATE_KEY)}, ${JSON.stringify(JSON.stringify(prefs.state))});
      localStorage.setItem(${JSON.stringify(SITE_TAB_NAV_KEY)}, ${JSON.stringify(prefs.tabNavsVisible ? "true" : "false")});
      ${themeWrite}
    } catch (e) {}
  })()`;
}

const READ_SITE_PREFS_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem(${JSON.stringify(SITE_STATE_KEY)});
    var tab = localStorage.getItem(${JSON.stringify(SITE_TAB_NAV_KEY)});
    var theme = localStorage.getItem(${JSON.stringify(SITE_THEME_KEY)});
    if (!raw && tab === null && theme === null) return null;
    return {
      state: raw ? JSON.parse(raw) : {},
      tabNavsVisible: tab === null ? true : tab === "true",
      theme: theme === "dark" || theme === "light" ? theme : "system"
    };
  } catch (e) {
    return null;
  }
})()`;

async function applySitePrefsToPage() {
  if (!wcv || !sitePrefs || !hasLoadedPage()) return;
  await wcv.webContents
    .executeJavaScript(writeSitePrefsScript(sitePrefs))
    .catch(() => {});
}

async function readSitePrefsFromPage(): Promise<SiteViewPrefs | null> {
  if (!wcv || !hasLoadedPage()) return null;
  const result = (await wcv.webContents
    .executeJavaScript(READ_SITE_PREFS_SCRIPT)
    .catch(() => null)) as SiteViewPrefs | null;
  return result;
}

function applyBounds() {
  if (!wcv) return;
  if (isHidden || isLoading) {
    wcv.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }
  wcv.setBounds(bounds);
}

function setLoading(mainWindow: BrowserWindow, loading: boolean) {
  isLoading = loading;
  applyBounds();
  sendToRenderer(mainWindow, "wcv-loading", { loading });
}

function normalizePathname(pathname: string) {
  return pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
}

/** Hash-only navigations on the same lesson must not loadURL (that hides the view). */
function isSameDocumentHashChange(currentUrl: string, targetUrl: string) {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return (
      current.origin === target.origin &&
      normalizePathname(current.pathname) === normalizePathname(target.pathname)
    );
  } catch {
    return false;
  }
}

function getOrCreateWcv(mainWindow: BrowserWindow): WebContentsView {
  if (!wcv) {
    wcv = new WebContentsView({
      webPreferences: {
        // Loads a minimal preload that exposes window.wcvBridge.send()
        // so injected JS can fire IPC events back to the main process.
        // See: src/electron/wcv-preload.cts
        preload: getWcvPreloadPath(),
      },
    });

    mainWindow.contentView.addChildView(wcv);
    wcv.setBackgroundColor(THEME_BACKGROUND[getAppliedResolvedTheme()]);

    const emitUrl = () => {
      const url = wcv?.webContents.getURL();
      if (url) sendToRenderer(mainWindow, "wcv-url-changed", { url });
    };
    wcv.webContents.on("did-start-navigation", (details) => {
      if (!details.isMainFrame || details.isSameDocument) return;
      setLoading(mainWindow, true);
    });
    wcv.webContents.on("did-navigate", emitUrl);
    wcv.webContents.on("did-navigate-in-page", emitUrl);
    wcv.webContents.on("dom-ready", () => {
      // Write prefs before CustardUI finishes fetchConfig() so it reads our blob.
      void (async () => {
        await applySitePrefsToPage();
        await wcv!.webContents.insertCSS(EMBED_CSS).catch(() => {});
      })();
    });
    wcv.webContents.on("did-fail-load", () => {
      setLoading(mainWindow, false);
    });
    wcv.webContents.on("did-stop-loading", () => {
      setLoading(mainWindow, false);
    });
    wcv.webContents.on("did-finish-load", async () => {
      await wcv!.webContents.insertCSS(EMBED_CSS).catch(() => {});
    });

    injectExerciseButtons(mainWindow);
  }
  return wcv;
}

/**
 * Injects the "Start Exercise" / "Verify Solution" buttons into the WCV page,
 * and replaces hands-on hop-prep option panels with a "Start Hands-on" button.
 * The download-info div is removed outright; the verify-info div is replaced
 * with both exercise buttons side by side, so they sit together at the bottom of
 * the exercise box. Clicking uses window.wcvBridge (exposed by
 * wcv-preload.cts) to fire an IPC event back to the main process.
 *
 * Returns a cleanup function that removes the dom-ready listener.
 */
function injectExerciseButtons(mainWindow: BrowserWindow) {
  const wcv = getOrCreateWcv(mainWindow);

  // Listen for IPC messages sent from the WCV page via window.wcvBridge.send()
  wcv.webContents.on("ipc-message", (_event, channel, ...args) => {
    if (channel === "wcv-start-exercise") {
      const { exerciseId } = args[0] as { exerciseId: string };
      console.log("[wcv] start exercise clicked:", exerciseId);
      void startExercise(mainWindow, `${exerciseId}`);
    } else if (channel === "wcv-verify-exercise") {
      const { exerciseId } = args[0] as { exerciseId: string };
      console.log("[wcv] verify exercise clicked:", exerciseId);
      _verify(mainWindow, exerciseId);
    }
  });

  const handler = async () => {
    // All DOM manipulation must live inside the executeJavaScript string —
    // DOM nodes cannot cross the process boundary.
    // window.wcvBridge is available because wcv-preload.cts is loaded.
    await wcv.webContents.executeJavaScript(`
      (function() {
        var SOLID_BG = "#2d864e";
        var SOLID_HOVER = "#236e3d";
        var OUTLINE_BORDER = "#2d864e";

        function isDark() {
          return document.documentElement.getAttribute("data-bs-theme") === "dark";
        }

        function outlineColors() {
          return isDark()
            ? { text: "#75b798", hoverBg: "#1f3932" }
            : { text: "#236e3d", hoverBg: "#f2faf5" };
        }

        var ICON_DOWNLOAD = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';
        var ICON_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 6 9 17l-5-5"/></svg>';

        var BASE_STYLE = "display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:6px; font-size:14px; font-weight:500; font-family:Inter,system-ui,sans-serif; cursor:pointer; line-height:20px;";

        function styleSolid(btn) {
          btn.style.cssText = BASE_STYLE + "background:" + SOLID_BG + "; color:#fff; border:none; box-shadow:0 1px 2px rgba(0,0,0,0.05);";
          btn.addEventListener("mouseenter", function () { btn.style.background = SOLID_HOVER; });
          btn.addEventListener("mouseleave", function () { btn.style.background = SOLID_BG; });
        }

        function styleOutline(btn) {
          var colors = outlineColors();
          btn.style.cssText = BASE_STYLE + "background:transparent; color:" + colors.text + "; border:1px solid " + OUTLINE_BORDER + ";";
          btn.addEventListener("mouseenter", function () { btn.style.background = colors.hoverBg; });
          btn.addEventListener("mouseleave", function () { btn.style.background = "transparent"; });
        }

        function createStartButton(id, label) {
          var btn = document.createElement("button");
          btn.innerHTML = ICON_DOWNLOAD + '<span>' + (label || 'Start Exercise') + '</span>';
          styleSolid(btn);
          btn.addEventListener("click", function () {
            window.wcvBridge.send("wcv-start-exercise", { exerciseId: id });
          });
          return btn;
        }

        function createVerifyButton(id) {
          var btn = document.createElement("button");
          btn.innerHTML = ICON_CHECK + '<span>Verify Solution</span>';
          styleOutline(btn);
          btn.addEventListener("click", function () {
            window.wcvBridge.send("wcv-verify-exercise", { exerciseId: id });
          });
          return btn;
        }

        /**
         * Removes the old download-info divs (their button now lives
         * alongside Verify) and replaces each verify-info div with both
         * buttons side by side. Hands-on hop-prep option panels (fresh
         * sandbox + optional manual setup) are replaced by a single
         * Start Hands-on button. Safe to call multiple times.
         */
        function cardHeaderText(el) {
          var header = el.querySelector('.card-header');
          return (header && header.textContent) || '';
        }

        function extractHandsOnId(card) {
          var codes = card.querySelectorAll('code');
          for (var i = 0; i < codes.length; i++) {
            var match = (codes[i].textContent || '').trim().match(/^gitmastery download (hp-[a-z0-9-]+)$/);
            if (match) return match[1];
          }
          return null;
        }

        function removeBothOptionsIntro(container) {
          var prev = container.previousElementSibling;
          if (!prev || prev.tagName !== 'P') return;
          var text = prev.textContent || '';
          if (text.indexOf('manually') === -1) return;
          if (text.indexOf('Git-Mastery') === -1 && text.indexOf('both options') === -1) return;
          prev.remove();
        }

        function injectHandsOnButtons() {
          document.querySelectorAll('.card').forEach(function (card) {
            if (cardHeaderText(card).indexOf('Create a fresh sandbox') === -1) return;
            var container = card.closest('.card-container');
            if (!container || container.getAttribute('data-gm-hands-on-injected')) return;

            var id = extractHandsOnId(card);
            if (!id) {
              var header = card.querySelector('.card-header');
              if (isCardCollapsed(card) && header) {
                header.click();
                setTimeout(injectButtons, 50);
              }
              return;
            }

            var next = container.nextElementSibling;
            if (next && cardHeaderText(next).indexOf('Manually set up a sandbox') !== -1) {
              next.remove();
            }

            removeBothOptionsIntro(container);

            var wrapperId = 'hands-on-' + id;
            var wrapper = document.createElement('div');
            if (!document.getElementById(wrapperId)) wrapper.id = wrapperId;
            wrapper.setAttribute('data-gm-hands-on-injected', '1');
            wrapper.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:12px; padding-bottom:8px;';
            wrapper.appendChild(createStartButton(id, 'Start Hands-on'));
            container.replaceWith(wrapper);
          });
        }

        function injectButtons() {
          document.querySelectorAll('div[id^="ex-download-info-"]').forEach(function (el) {
            el.remove();
          });

          document.querySelectorAll('div[id^="ex-verify-info-"]').forEach(function (el) {
            var id = el.id.replace("ex-verify-info-", "");
            var container = document.createElement("div");
            container.style.cssText = "display:flex; align-items:center; gap:8px; margin-top:12px; padding-bottom:20px;";
            container.appendChild(createStartButton(id));
            container.appendChild(createVerifyButton(id));
            el.replaceWith(container);
          });

          injectHandsOnButtons();
        }

        var observedCollapses = window.__gmObservedCollapses || (window.__gmObservedCollapses = new WeakSet());

        function observeCardCollapses() {
          document.querySelectorAll('.card-collapse').forEach(function (cardCollapse) {
            if (observedCollapses.has(cardCollapse)) return;
            observedCollapses.add(cardCollapse);
            var observer = new MutationObserver(function () {
              injectButtons();
            });
            observer.observe(cardCollapse, { childList: true, subtree: true });
          });
        }

        function isCardCollapsed(card) {
          var header = card.querySelector('.card-header');
          if (header) {
            var expanded = header.getAttribute('aria-expanded');
            if (expanded === 'true') return false;
            if (expanded === 'false') return true;
          }
          // Collapsed MarkBind panels keep an empty .card-collapse (comment + hidden hr).
          return !card.querySelector('.card-body');
        }

        function expandHandsOnHash(id) {
          if (id.indexOf('hands-on-hp-') !== 0) return false;
          injectButtons();
          var el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ block: 'start' });
            return true;
          }
          setTimeout(function () {
            injectButtons();
            var target = document.getElementById(id);
            if (target) target.scrollIntoView({ block: 'start' });
          }, 50);
          return true;
        }

        function expandHashTarget() {
          var id = (location.hash || '').replace(/^#/, '');
          if (!id) return;
          if (expandHandsOnHash(id)) return;
          var el = document.getElementById(id);
          if (!el) return;
          var card = el.closest('.card');
          if (!card) {
            el.scrollIntoView({ block: 'start' });
            return;
          }
          var header = card.querySelector('.card-header') || card;
          if (isCardCollapsed(card)) {
            header.click();
            setTimeout(function () {
              observeCardCollapses();
              injectButtons();
              el.scrollIntoView({ block: 'start' });
            }, 50);
          }
          el.scrollIntoView({ block: 'start' });
          observeCardCollapses();
          injectButtons();
        }

        observeCardCollapses();
        injectButtons();
        expandHashTarget();

        if (!window.__gmExercisePageHooks) {
          window.__gmExercisePageHooks = true;
          window.addEventListener('hashchange', expandHashTarget);
          window.addEventListener('load', expandHashTarget);
        }
      })()
    `);
  };

  wcv.webContents.addListener("dom-ready", handler);
  return () => wcv.webContents.removeListener("dom-ready", handler);
}
export function setupWebContentsViewIpc(mainWindow: BrowserWindow) {
  registerThemeBackgroundTarget((color) => {
    wcv?.setBackgroundColor(color);
  });
  ipcMainOn(
    "wcv-size",
    ({
      x,
      y,
      width,
      height,
    }: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      getOrCreateWcv(mainWindow);

      /**
       * Note: Issue with Electron apps & scaling for web contents view.
       * We need to account for the display scaling.
       *
       * If the user only has one display, then it's easy -- screen.getDisplayNearestPoint always returns the same display.
       * But if the user has two displays with different scale factor, then we base off the mouse position when deciding which display to
       * find the scaling factor of.
       *
       * Consider that when the screen size changes, the
       */

      const mainWindowBounds = getMainWindow().getContentBounds();
      const centerPt = {
        x: mainWindowBounds.x + mainWindowBounds.width / 2,
        y: mainWindowBounds.y + mainWindowBounds.height / 2,
      };

      const display = screen.getDisplayNearestPoint(centerPt);
      const scalingFactor = display.scaleFactor;

      // screen.screenToDipPoint is Windows-only. On macOS/Linux, Electron already
      // works in DIP (logical pixel) space, so raw x/y values need no conversion.
      const dipX = x;
      const dipY = y;
      bounds = {
        x: dipX / scalingFactor,
        y: dipY / scalingFactor,
        width: width / scalingFactor,
        height: height / scalingFactor,
      };

      if (!isHidden && !isLoading) {
        getOrCreateWcv(mainWindow).setBounds(bounds);
      }
    },
  );

  ipcMainOn("wcv-show", () => {
    getOrCreateWcv(mainWindow);
    isHidden = false;
    applyBounds();
  });

  ipcMainOn("wcv-navigate", ({ url }: { url: string }) => {
    const view = getOrCreateWcv(mainWindow);
    const currentUrl = view.webContents.getURL();
    if (currentUrl && isSameDocumentHashChange(currentUrl, url)) {
      const hash = new URL(url).hash;
      void view.webContents.executeJavaScript(
        `location.hash = ${JSON.stringify(hash)};`,
      );
      return;
    }
    setLoading(mainWindow, true);
    view.webContents.loadURL(url);
  });

  // Temporarily hide the wcv, whenever we need to display a full screen modal.
  ipcMainOn("wcv-hide", () => {
    isHidden = true;
    applyBounds();
  });

  ipcMainHandle("wcv-get-site-prefs", async () => {
    getOrCreateWcv(mainWindow);
    if (sitePrefs) return sitePrefs;
    return await readSitePrefsFromPage();
  });

  ipcMainHandle("wcv-set-site-prefs", async ({ reload, ...prefs }) => {
    sitePrefs = {
      state: prefs.state,
      tabNavsVisible: prefs.tabNavsVisible,
      theme: prefs.theme,
    };
    const view = getOrCreateWcv(mainWindow);
    await applySitePrefsToPage();
    if (reload && hasLoadedPage()) {
      view.webContents.reload();
    }
    return true;
  });

  // Clean up when the window is closed
  mainWindow.on("closed", () => {
    wcv = null;
  });
}
