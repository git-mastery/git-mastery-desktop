# App walkthrough

A two-step tour runs on first launch and whenever the learner clicks Help (the
question mark in the header). Each step dulls everything except one area and
explains it; the learner clicks Next to move on. There is no skip: the tour is
two clicks long. After the last step the app behaves as normal.

1. **Lessons.** The terminal column and header are dimmed.
2. **Terminal.** The lesson page, tours panel and header are dimmed, and the
   terminal gets a brand outline.

"Seen" lives in renderer `localStorage` (`gm-walkthrough-seen`). It is a
display preference with no meaning to the main process, like the other
renderer-only flags.

## The lesson page is dimmed from inside the page

The lesson site is a native `WebContentsView` that paints above all DOM, so a
React overlay cannot dull it. For step 2 the renderer sends `wcv-set-dimmed`,
and main injects a fixed, full-page layer into the lesson page itself. The
colour mirrors the `--gm-dim` token for the current theme, so it matches the
dimmed DOM panes. Main keeps the flag and re-applies it on `dom-ready`, so the
dim survives a navigation or a page that finishes loading mid-tour. The layer
also swallows clicks, so the learner cannot wander off during the step.

## Cards always sit in the terminal column

For the same reason, a card placed over the lesson pane would be hidden. Both
step cards render inside the terminal column: centred over the dimmed terminal
in step 1, and along the bottom of the terminal in step 2. They are compact
callouts, so the title is Inter semibold like a toast rather than the serif
modal title.

## Rejected

- **Hide the native view for step 2.** Simple, but the lesson pane goes blank
  instead of dull, and the learner loses the sense of where the lessons are.
- **A tour library (spotlight / popover).** Such libraries position DOM
  popovers and cutouts, which cannot reach the native view.
- **Render the card inside the lesson page.** It could sit anywhere, but its
  buttons would need a round trip through the page bridge and main, and it
  would have to re-implement the house styles in injected CSS.
