# Customise preferences (CustardUI + MarkBind + desktop theme)

The embedded Git-Mastery site is a MarkBind page with the [CustardUI](https://github.com/CustardUI/custardui) plugin. CustardUI owns **content** customisation (show / peek / hide sections, OS and Git-UI tabs, GitHub username placeholders, course editions). MarkBind owns **lesson-page colour** (`data-bs-theme`). The Electron renderer owns **desktop chrome colour** (`html[data-theme]`). A header sun/moon toggle drives Light or Dark for chrome, the terminal, and the lesson pages together. There is no System option: a missing or legacy `"system"` value is resolved from the OS once and then stored as Light or Dark.

## Why the in-page gear is hidden

CustardUI paints a green settings icon (`.cv-settings-icon`, middle-left, `#198754`) and an intro callout (`.cv-callout-wrapper`). Those live in the `WebContentsView`, not in the React header.

The site config (`https://git-mastery.org/custardui.config.json`) has `settings.enabled: true`. That flag cannot be flipped from this app. The desktop injects CSS in `src/electron/ipc/webContentsView.ts` (`EMBED_CSS`) to hide the gear and callout, the same way it already hides the MarkBind navbar. `.cv-widget-root` stays (toasts and share overlay).

Hiding the navbar also hides MarkBind’s own dark-mode toggle, so colour is owned here too.

## Who owns what

- **Header theme toggle** is the only colour control. It writes renderer `gm-theme`, electron `config.json` `theme`, and the page’s `markbind-theme`, then reloads the loaded lesson so MarkBind applies the complete theme.
- **Desktop Settings → Customise** edits CustardUI content prefs only. Saving it must not overwrite the header theme.
- **CustardUI on the page** still applies content prefs. **MarkBind `theme-manager.js`** still applies lesson-page colour from `localStorage` on navigation. The desktop chrome reads `gm-theme` and sets `data-theme` / `color-scheme` on `<html>`.
- A copy of the content prefs is kept in renderer `localStorage` (`site-view-prefs`) so the panel is instant, and pushed into the page origin’s `localStorage` so the site scripts can read it.

## Storage contract

CustardUI prefixes keys with `storageKey` from the site config (`git-mastery`):

| Key                               | Value                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `git-mastery-custardUI-state`     | JSON `{ shownToggles, peekToggles, hiddenToggles, tabs, placeholders }` |
| `git-mastery-cv-tab-navs-visible` | `"true"` / `"false"`                                                    |
| `git-mastery-cv-adaptation`       | Adaptation id (e.g. `cs2103`). Removed when the field is empty.         |
| `markbind-theme`                  | `"light"` / `"dark"`. Always set; never removed.                        |

Renderer `gm-theme` and electron `config.json` `theme` store the same Light / Dark choice. Older profiles that stored `"system"` (or `site-view-prefs.theme`) are migrated on first launch by resolving the OS once. Renderer `site-view-prefs.adaptationId` is the desktop copy of `git-mastery-cv-adaptation`.

The renderer cannot read `https://git-mastery.org` storage (different origin from `localhost:5123`). Main writes and reads it with `webContents.executeJavaScript`.

MarkBind’s `theme-manager.js` runs in `<head>` and sets `data-bs-theme` from `markbind-theme`. Main writes that key before reloading after a theme toggle, preserving MarkBind’s normal startup path on every lesson. On `dom-ready`, main also synchronizes the key and attributes without triggering another reload.

Desktop chrome: an inline script in `index.html` reads `gm-theme` (migrating a leftover `site-view-prefs.theme` if needed) and sets `data-theme` before React paints. `ThemeProvider` keeps it in sync and tells main (`set-app-theme`) so `nativeTheme.themeSource`, the `BrowserWindow` background, and the WebContentsView background (`#ffffff` / `#212529`) match.

Precedence CustardUI uses on boot: URL query (then stripped) > `localStorage` > adaptation preset > config defaults. The desktop writes `localStorage` and does not use URL params (`showUrl` is already `false` on the site).

## Apply path

CustardUI `await`s `fetchConfig()` before it reads `localStorage`. Electron `dom-ready` fires at DOMContentLoaded, so main writes the blob there and wins that race on every navigation.

1. Renderer may already have `site-view-prefs`. `WebsiteWrapper` sends them to main (`reload: false`) before the first `loadURL`.
2. On each WCV `dom-ready`, main writes the CustardUI keys if it holds a blob, writes `markbind-theme` plus `data-bs-theme` from the applied desktop theme, and awaits `insertCSS(EMBED_CSS)` before restoring native-view bounds.
3. Saving in Customise writes renderer storage, updates main, writes the page, and reloads the current URL. It does not change theme.
4. The header toggle updates chrome immediately, persists `gm-theme` and `config.json`, writes `markbind-theme`, and reloads the loaded lesson once. Startup synchronization of an unchanged theme does not reload.
5. A course edition is saved the same way after the renderer has fetched `https://git-mastery.org/versions/<id>/<id>.json` and checked that the JSON `id` matches. An empty field removes `git-mastery-cv-adaptation` and reloads. A failed lookup stays in the panel and does not write the key: CustardUI would clear a missing adaptation, and the next `dom-ready` would put a bad id back.

## Native-view visibility

A full lesson navigation, including theme toggles and Customise saves, must not paint MarkBind’s original navbar, site nav, footer, or CustardUI gear. The `WebContentsView` stays at zero bounds from the moment that navigation starts until `EMBED_CSS` is installed on that document.

`did-start-navigation` and every programmatic `reload()` / `loadURL()` collapse the view first. Reveal is one per-navigation promise: apply site prefs and theme, await `insertCSS(EMBED_CSS)`, then restore bounds. A completion from an older load cannot reveal during a newer one. Hash-only same-document changes keep the already-injected stylesheet and do not collapse. A failed load is revealed on its own so the error page is not stuck hidden; an aborted load is ignored so it cannot unhide a newer navigation.

The hide rules stay in main-process `EMBED_CSS`. `src/electron/wcv-preload.cts` remains an IPC-only bridge.

`siteManaged` placeholders (`course`) are skipped; CustardUI would strip them on persist anyway. The adaptation preset sets `course`.

The header Progress item opens `/progress-dashboard/#/dashboard/{username}` when the `username` placeholder is set, otherwise the dashboard home.

The panel schema is fetched live from `https://git-mastery.org/custardui.config.json` so toggle IDs do not drift. On first open with no desktop copy, the panel seeds from the page’s existing `localStorage` so a previous in-page modal session is not clobbered.

## Course edition

A link such as `https://git-mastery.org/#/cs2103` is a [CustardUI adaptation](https://custardui.js.org/authorGuide/adaptations/adaptations.html), not a different origin. CustardUI loads `/versions/<id>/<id>.json` and keeps the id in `git-mastery-cv-adaptation`. Lesson, exercise, and tour URLs stay on the standard paths. The lessons menu still lists the full catalog; the adaptation changes labels, theme variables, and insertions on those pages.

Settings → Customise holds a **Course edition** field for that id. The desktop writes the key on `dom-ready` (same race as the other CustardUI keys) and reloads so CustardUI reads it at startup. Navigate and post-save reload strip leftover `#/<id>` and `?adapt=` so those URL indicators cannot override or restore the stored id. Exercise hashes (`#exercise-…`) and the progress dashboard hash (`#/dashboard/…`) stay.

Rejected:

- Putting `#/<id>` on every lesson URL. `wcv-navigate` treats a same-path target as a hash assignment, exercise and hands-on hashes would collide, and CustardUI only reads the adaptation at startup.
- Navigating to `?adapt=clear` to reset. That also deletes `git-mastery-custardUI-state`. Clearing is `removeItem` plus reload of the current URL with adaptation indicators stripped.
- Keeping a System colour option. Learners treated it as a third appearance rather than “follow the OS”, and later OS changes made the app look as if it had forgotten the last choice. First launch (and leftover `"system"` values) still read the OS once, then store Light or Dark.

The progress dashboard at `/progress-dashboard/#/dashboard/...` is a separate app and does not load CustardUI, so that hash is not an adaptation id.
