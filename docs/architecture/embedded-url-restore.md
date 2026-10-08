# Embedded site location restore

The last lessons / exercises / progress URL is stored in renderer `localStorage`
(`gm-last-embedded-url`) so a restart opens the same page instead of always
`/lessons/`.

On every URL change (`navigate` or in-page navigation from the native view),
the renderer writes the full URL (pathname, search, and hash) if it is
restorable. On boot, `WebsiteWrapper` reads that key and navigates there;
missing or invalid values fall back to the lessons home.

A URL is restorable only when its origin is `https://git-mastery.org` and the
path is one of the three site sections (`/lessons`, `/exercises-directory`,
`/progress-dashboard`). Hashes are kept so exercise and hands-on anchors and
the progress dashboard restore correctly.

This is a display preference with no meaning to the main process, like
`gm-walkthrough-seen`. It does not persist terminal cwd or chrome layout.
