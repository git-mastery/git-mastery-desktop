---
name: git-mastery-design
description: >-
  Git-Mastery Desktop house UI — tokens, surfaces, component recipes, layout
  patterns, and quality checklist for the Electron renderer. Triggers — design
  system, house style, bone canvas, brand green CTA, status pills, desktop tool
  UI, restyling a page or component, migrating off Mantine, Tailwind v4 tokens.
  Not for Electron main-process work, IPC, or data fetching.
metadata:
  version: "1.1.0"
---

# git-mastery-design

House design language for Git-Mastery Desktop: semantic light/dark surfaces, one green brand accent, semantic status color, serif headings over a dense sans body. This skill is **renderer UI only** — no IPC, packaging, or data-layer guidance.

```
.agents/skills/git-mastery-design/
├── SKILL.md                              # workflow + principles (this file)
└── references/
    ├── tokens-and-surfaces.md            # color, type, spacing, shadows
    └── components-and-patterns.md        # recipes + layout patterns + checklist
```

## When to use

| Use this skill                                            | Use something else                                     |
| --------------------------------------------------------- | ------------------------------------------------------ |
| Styling any new page, panel, or component                 | Electron main process, IPC, or `node-pty` work         |
| Restyling or porting a component off Mantine              | Data fetching, query hooks, exercise/tour domain logic |
| Auditing UI for brand / density / semantic-color drift    | Build, packaging, or release tasks                     |
| Generating Tailwind v4 tokens and component class recipes | —                                                      |

## Agent workflow

1. **Read references before writing UI** — start with [`references/tokens-and-surfaces.md`](references/tokens-and-surfaces.md), then [`references/components-and-patterns.md`](references/components-and-patterns.md).
2. **Pick a shell mode** (see below). Default to **desktop shell** unless the screen owns the whole window.
3. **Use existing tokens** — brand green, semantic canvas/surface/text/border, no invented palettes.
4. **Compose from primitives** — solid `Card`, field labels, one primary CTA per cluster, semantic status pills. Reuse house patterns (checklist, modal panel).
5. **Run the checklist** at the end of [`references/components-and-patterns.md`](references/components-and-patterns.md) before shipping.

## Design principles

1. **Tool UI, not marketing.** Quiet chrome, hairline borders, flat opaque panels — not hero gradients, neon glow, or landing-page typography.
2. **One brand accent.** Primary actions and focus rings use brand green (`#2d864e`). Status meaning uses the same green for success plus red / amber / sky — never as decorative page chrome.
3. **Solid surfaces by default.** Panes, cards, and modals are opaque with a hairline border. Light: white on bone canvas. Dark: `#212529` matching git-mastery.org.
4. **Serif for titles, sans for everything else.** Noto Serif carries page and section titles; Inter carries all body, control, and chip text.
5. **Density with air.** ~13–14px body, ~11px chips and field labels. Comfortable padding inside cards; tight toolbars above lists.
6. **Semantic color is never the only signal.** Pair color with text, icons, or `aria-label` on status dots and pills.
7. **One solid primary per action cluster.** Everything else is secondary, outline, or ghost.
8. **The native view wins.** Anything painted by `WebContentsView` sits above all DOM — design around it rather than over it (see [`references/components-and-patterns.md`](references/components-and-patterns.md) § Native view constraints).
9. **One theme preference.** Light / Dark / System applies to desktop chrome and the embedded lesson pages. Reach for semantic tokens (`bg-surface`, `text-fg`), not `dark:` class variants or one-off hex.

## Shell modes

Two layouts. **Tokens and components are identical**; only chrome and title scale differ.

### Desktop shell (default)

The normal running state of the app.

- Fixed 64px header (Lessons / Exercises / Progress on the left, settings on the right), a main content pane, and a resizable aside holding the terminal. The lessons panel toggle lives in the content pane (slim bar above the native view when closed; panel header when open), not in the header.
- **No page-level scroll.** The window is the viewport; each pane owns its own scroll container.
- Content pane titles use the serif h1 scale; per-view toolbars sit inside the pane, not in the header.
- The main pane may host the native web view, in which case it must stay an empty bounds placeholder.

### Full-screen focus

For first-run onboarding and any flow that owns the whole window.

- Bone canvas fills the window in light; dark uses the site page colour `#212529`. One centered card (~680px, `max-w-[92vw]`) holds the flow.
- The native view must be suppressed for the duration — it would paint straight through the card.
- Short progress rails (stepper) stay narrow and centered rather than stretched across the card.

## Stack

| Layer      | Used here              | Notes                                                                 |
| ---------- | ---------------------- | --------------------------------------------------------------------- |
| UI         | React 19 + TypeScript  | Function components; avoid `any`                                      |
| Runtime    | Electron renderer      | Single window; no router, view state lives in context                 |
| Styling    | **Tailwind CSS v4**    | Tokens live in `@theme` inside CSS — there is no `tailwind.config.js` |
| Icons      | `@tabler/icons-react`  | 14–18px in toolbars; muted neutral default                            |
| Components | Hand-rolled primitives | Replace Mantine with recipes from references — do not add new Mantine |

Tailwind v4 matters: custom colors, fonts, and shadows are declared as CSS variables in `@theme` and consumed as normal utilities (`bg-brand-600`, `bg-surface`, `text-fg`, `font-heading`, `shadow-card`). Do not write a v3-style config file. Semantic surface tokens swap with `html[data-theme]`.

## Always

- Inter body / Noto Serif headings; semantic canvas / surface / `text-fg`.
- Brand CTA `#2d864e` → hover `#236e3d` in both themes.
- Surfaces: `bg-surface`, `border-border`, 12–16px radius; `shadow-card` only on elevated panels (modals, dropdowns).
- Inputs: 12px radius, `border-border`, brand focus ring (`ring-focus-ring`).
- Status pills: 11px, semantic fill / text / border, paired with text or `aria-label`.
- Custom modals and toasts — never native `alert` / `confirm`.
- Disabled controls: ~50% opacity, no pointer.
- Suppress the native web view whenever a modal, menu, or overlay opens above its bounds.

## Never

- Mantine (or any third-party UI library) for new or migrated UI — use hand-rolled Tailwind primitives from references.
- `backdrop-blur`, translucent `bg-white/…`, or frosted-glass panel styling — the app is flat and opaque.
- Blue as an accent or CTA — it reads as a hyperlink and fights the brand green.
- `slate-*` utilities. The light gray ramp is `neutral-*`; themed chrome uses semantic tokens (`surface`, `fg`, `muted`, `border`).
- Serif in body copy, buttons, labels, or chips.
- Purple-to-indigo marketing gradients, glow stacks, or emoji decoration.
- Broadsheet zero-radius newspaper layouts for tools.
- Random font swaps (Roboto-only shells, monospace UI bodies).
- Heavy drop shadows on content cards.
- DOM overlays, blur, or z-index tricks layered over the native view region — they will not render.
- `dark:` class variants or one-off hex when a semantic token exists. The terminal pane stays black on purpose — do not restyle xterm from the app theme.

## Accessibility & copy

- **Color + text:** every status hue appears beside a word or `aria-label`.
- **Focus:** visible brand focus ring on interactive controls; don't remove outlines without a replacement.
- **Copy:** English only. Sentence case for labels and buttons; say what happens next rather than naming the mechanism.

## Reference

| Topic                   | Where to look                                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| Token & surface spec    | [`references/tokens-and-surfaces.md`](references/tokens-and-surfaces.md)         |
| Component & layout spec | [`references/components-and-patterns.md`](references/components-and-patterns.md) |
| Tokens as shipped       | [`src/ui/index.css`](../../../src/ui/index.css)                                  |
| Fonts loaded            | [`index.html`](../../../index.html)                                              |
