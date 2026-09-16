# Customise UI preferences (CustardUI + MarkBind + desktop theme)

The embedded Git-Mastery site is a MarkBind page with the [CustardUI](https://github.com/CustardUI/custardui) plugin. CustardUI owns **content** customisation (show / peek / hide sections, OS and Git-UI tabs, GitHub username placeholders). MarkBind owns **lesson-page colour** (`data-bs-theme`). The Electron renderer owns **desktop chrome colour** (`html[data-theme]`). One Settings control — Light / Dark / System — drives both.

## Why the in-page gear is hidden

CustardUI paints a green settings icon (`.cv-settings-icon`, middle-left, `#198754`) and an intro callout (`.cv-callout-wrapper`). Those live in the `WebContentsView`, not in the React header.

The site config (`https://git-mastery.org/custardui.config.json`) has `settings.enabled: true`. That flag cannot be flipped from this app. The desktop injects CSS in `src/electron/ipc/webContentsView.ts` (`EMBED_CSS`) to hide the gear and callout, the same way it already hides the MarkBind navbar. `.cv-widget-root` stays (toasts and share overlay).

Hiding the navbar also hides MarkBind’s own dark-mode toggle, so colour is owned here too.

## Who owns what

- **Desktop Settings → Customise UI** is the only editor after the gear is hidden.
- **CustardUI on the page** still applies content prefs. **MarkBind `theme-manager.js`** still applies lesson-page colour from `localStorage`. The desktop chrome reads the same preference and sets `data-theme` / `color-scheme` on `<html>`.
- A copy of the prefs is kept in renderer `localStorage` (`site-view-prefs`) so the panel is instant, and pushed into the page origin’s `localStorage` so the site scripts can read it. The theme preference is also written to electron `config.json` so the window and WebContentsView can boot with the right background.

## Storage contract

CustardUI prefixes keys with `storageKey` from the site config (`git-mastery`):

| Key                               | Value                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `git-mastery-custardUI-state`     | JSON `{ shownToggles, peekToggles, hiddenToggles, tabs, placeholders }` |
| `git-mastery-cv-tab-navs-visible` | `"true"` / `"false"`                                                    |
| `markbind-theme`                  | `"light"` / `"dark"`. Removed when the user picks System.               |

Renderer `site-view-prefs.theme` and electron `config.json` `theme` store the same Light / Dark / System choice.

The renderer cannot read `https://git-mastery.org` storage (different origin from `localhost:5123`). Main writes and reads it with `webContents.executeJavaScript`.

MarkBind’s `theme-manager.js` runs in `<head>` and sets `data-bs-theme` from `markbind-theme` (or `prefers-color-scheme` if unset). Saving reloads so that script sees the new value with no flash.

Desktop chrome: an inline script in `index.html` reads `site-view-prefs.theme` and sets `data-theme` before React paints. `ThemeProvider` keeps it in sync, listens for OS changes when the preference is System, and tells main (`set-app-theme`) so `nativeTheme.themeSource`, the `BrowserWindow` background, and the WebContentsView background (`#ffffff` / `#212529`) match.

Precedence CustardUI uses on boot: URL query (then stripped) > `localStorage` > adaptation preset > config defaults. The desktop writes `localStorage` and does not use URL params (`showUrl` is already `false` on the site).

## Apply path

CustardUI `await`s `fetchConfig()` before it reads `localStorage`. Electron `dom-ready` fires at DOMContentLoaded, so main writes the blob there and wins that race on every navigation.

1. Renderer may already have `site-view-prefs`. `WebsiteWrapper` sends them to main (`reload: false`) before the first `loadURL`.
2. On each WCV `dom-ready`, main writes the keys if it holds a blob.
3. Saving in the panel writes renderer storage, updates main, writes the page, reloads the current URL, and updates `ThemeProvider` so chrome and native backgrounds follow without a second control.

`siteManaged` placeholders (`course`) are skipped; CustardUI would strip them on persist anyway.

The header Progress item opens `/progress-dashboard/#/dashboard/{username}` when the `username` placeholder is set, otherwise the dashboard home.

The panel schema is fetched live from `https://git-mastery.org/custardui.config.json` so toggle IDs do not drift. On first open with no desktop copy, the panel seeds from the page’s existing `localStorage` so a previous in-page modal session is not clobbered.
