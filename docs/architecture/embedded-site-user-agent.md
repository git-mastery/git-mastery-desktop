# Chrome user agent for the embedded lesson site

The lesson `WebContentsView` loads `https://git-mastery.org`, which embeds YouTube. Electron’s default user agent includes the app name and `Electron/<version>`. YouTube treats that client as a bot and shows “Sign in to confirm you’re not a bot”; signing in a popup does not unlock the iframe (third-party cookie partitioning).

## What we do

On the lesson view only, strip those two tokens so the UA looks like Chrome. The same override is applied to `window.open` popups from that view (YouTube/Google sign-in) by creating the child `BrowserWindow` ourselves and setting its UA before it navigates.

The React shell in [`src/electron/main.ts`](../../src/electron/main.ts) is unchanged. We do not set `app.userAgentFallback` or `session.defaultSession.setUserAgent`.

## What we did not do

If a video still demands sign-in after this, the next steps are:

1. Disable Chromium third-party storage partitioning so popup login cookies are visible to the YouTube iframe.
2. Open the watch URL in the system browser instead of playing in-app.
