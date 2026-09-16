# Git-Mastery — tokens & surfaces

Agent SSOT for color, typography, spacing, radius, shadow, motion, and surface recipes.
The shipped subset lives in [`src/ui/index.css`](../../../../src/ui/index.css).

Light and Dark share the same token names. Values swap on `html[data-theme]`.
System follows `prefers-color-scheme`. Do not add `dark:` class variants when a
semantic token exists.

---

## 1. Color

### Semantic chrome (use these)

| Token             | Light                  | Dark                      | Role                                  |
| ----------------- | ---------------------- | ------------------------- | ------------------------------------- |
| Canvas            | `#f8f8f8`              | `#212529`                 | Onboarding / window background        |
| Surface           | `#ffffff`              | `#212529`                 | Header, panes, cards, modals          |
| Subtle            | `#f5f5f5`              | `#2b3035`                 | Code chips, raised/secondary fill     |
| Hover             | `#f5f5f5`              | `#343a40`                 | Row / control hover                   |
| Text primary      | `#333333`              | `#dee2e6`                 | Body, headings                        |
| Text muted        | `#666666`              | `#c2c8ce`                 | Helpers, secondary                    |
| Text faint        | `#a3a3a3`              | `#adb5bd`                 | Placeholders, meta                    |
| Border            | `#e5e5e5`              | `#495057`                 | Hairlines, dividers                   |
| Overlay           | `rgb(23 23 23 / 0.25)` | `rgb(0 0 0 / 0.5)`        | Modal scrim                           |
| Accent text       | `#236e3d`              | `#75b798`                 | Active nav, outline CTA, success text |
| Accent soft       | `#f2faf5`              | `#1f3932`                 | Soft fill, selected row               |
| Accent soft hover | `#e1f4e8`              | `#264a40`                 | Soft icon hover                       |
| Accent border     | `#c8ead4`              | `#4ab98a`                 | Success pill / mint panel border      |
| Focus ring        | `#e1f4e8`              | `rgb(117 183 152 / 0.35)` | Control focus                         |

Tailwind: `bg-canvas`, `bg-surface`, `bg-subtle`, `bg-hover`, `text-fg`, `text-muted`, `text-faint`, `border-border`, `bg-overlay`, `text-accent`, `bg-accent-soft`, `border-accent-border`, `ring-focus-ring`.

Dark chrome values match git-mastery.org’s Bootstrap 5.3 / MarkBind theme (`[data-bs-theme=dark]`): page/card `#212529`, text `#dee2e6`, muted `#c2c8ce` (site `.dimmed`), border `#495057`, green accents `#75b798` / `#4ab98a`, mint panel `#1f3932`.

Do not use `slate-*`. Light-only leftover `neutral-*` utilities are fine for a static gray, but themed chrome should use the semantic tokens above.

### Brand scale (primary accent)

Unchanged across themes. Solid CTAs stay this green — it remains accessible on both canvases.

| Step    | Hex           | Role                           |
| ------- | ------------- | ------------------------------ |
| 50      | `#f2faf5`     | Light soft fill alias          |
| 100     | `#e1f4e8`     | Light focus ring alias         |
| 200     | `#c8ead4`     | Light soft border              |
| 300     | `#9ad6af`     |                                |
| 400     | `#5dc080`     | Focus border                   |
| 500     | `#3ba561`     |                                |
| **600** | **`#2d864e`** | **CTA / primary — `gm-green`** |
| 700     | `#236e3d`     | Primary hover / light accent   |
| 800     | `#1c5a31`     |                                |
| 900     | `#164928`     |                                |

`--color-gm-green` is an alias of brand-600, so existing usages keep working.

**Olive accent** `#717c4d` (`gm-dark-green`): secondary decorative accent only — never a CTA, never a status color.

### Semantic surfaces (pills / tags / soft badges)

Pattern: fill + text + border, **11px**, medium weight. Use the semantic classes, not raw `*-50` / `*-700`.

| Role                              | Light fill / text / border        | Dark fill / text / border         |
| --------------------------------- | --------------------------------- | --------------------------------- |
| Neutral / idle                    | `#f5f5f5` / `#666666` / `#e5e5e5` | `#2b3035` / `#c2c8ce` / `#495057` |
| Success / completed / ready       | `#f2faf5` / `#236e3d` / `#c8ead4` | `#1f3932` / `#75b798` / `#4ab98a` |
| Danger / failed / needs work      | `#fef3f2` / `#b42318` / `#fecdca` | `#2c0b0e` / `#ea868f` / `#842029` |
| Warning / in progress / attention | `#fffaeb` / `#b54708` / `#fedf89` | `#332701` / `#ffda6a` / `#997404` |
| Info / downloading / running      | `#f0f9ff` / `#0369a1` / `#bae6fd` | `#032830` / `#6edff6` / `#087990` |

Success reuses the brand hue — in this product "done" and "brand" are the same green. Because of that, **green is never used decoratively**: a green pill always means success.

Hard destructive **solid** button stays `#b42318`, hover `#912018`, white label — both themes. Danger _text_ and outline use `--color-danger` (`#b42318` light / `#ea868f` dark).

### Exercise status mapping

Keep any surface that reports exercise state consistent with this.

| Status                     | Pill style                                               |
| -------------------------- | -------------------------------------------------------- |
| `not-started`              | neutral                                                  |
| `in-progress`              | warning (amber)                                          |
| `incorrect` ("Needs work") | danger (red)                                             |
| `correct` ("Completed")    | success (brand green)                                    |
| Downloading                | info (sky), with a spinner                               |
| Active exercise            | `bg-accent-soft` + accent text                           |
| Unknown value from disk    | neutral fallback — never crash on an unrecognized status |

---

## 2. Typography

Both families are loaded in [`index.html`](../../../../index.html) and exposed as `--font-body` / `--font-heading`.

```text
body:     Inter, system-ui, sans-serif
headings: "Noto Serif", Georgia, serif
```

Serif is for titles only. Body, controls, labels, chips, and list rows are always Inter.

| Role                        | Size              | Weight  | Family | Notes                                               |
| --------------------------- | ----------------- | ------- | ------ | --------------------------------------------------- |
| Page title (h1)             | `2.05rem` / ~33px | 600     | serif  | One per view, line-height 1.3                       |
| Section title (h2)          | `1.45rem` / ~23px | 600     | serif  | Group headers, line-height 1.35                     |
| Card / modal title (h3)     | `1.2rem` / ~19px  | 600     | serif  | line-height 1.4                                     |
| Lead / subtitle             | ~16px             | 400     | sans   | Under a page title, muted                           |
| Body                        | 13–14px           | 400     | sans   | Default tool UI                                     |
| Micro label                 | 11–11.5px         | 500–600 | sans   | Uppercase, tracking 0.06–0.08em, faint              |
| Chip / badge                | 11px              | 500     | sans   | Semantic color                                      |
| Mono (paths, commands, ids) | inherit           | 400–500 | mono   | Monospace **only** for paths, commands, identifiers |

---

## 3. Spacing

| Token             | Value           | Use                        |
| ----------------- | --------------- | -------------------------- |
| Pane edge padding | 20–28px         | Content pane inset         |
| Card gap          | 16–20px         | Between major panels       |
| Card padding      | 16px (sm: 24px) | Card / modal content       |
| Control gap       | 8px             | Button groups              |
| List row padding  | 12px vertical   | Dense catalog rows         |
| Group gap         | 28px            | Between titled list groups |
| Meta row gap      | 12px            | Label ↔ value              |

Content panes cap readable text at ~820px; full-width is reserved for lists and panes that need it.

---

## 4. Radius

| Surface           | Radius     | Tailwind       |
| ----------------- | ---------- | -------------- |
| Page card / modal | **16px**   | `rounded-2xl`  |
| Icon chip         | **12px**   | `rounded-xl`   |
| Input / select    | **12px**   | `rounded-xl`   |
| Default button    | **6px**    | `rounded-md`   |
| Page chip         | **9999px** | `rounded-full` |
| Status pill       | **4–6px**  | `rounded`      |

---

## 5. Border & shadow

- Default border: `border-border`.
- Dividers: the same token, optionally at 80% opacity.

**Card shadow** (modals, dropdowns, elevated panels only):

Light:

```css
box-shadow:
  0 1px 2px rgb(23 23 23 / 0.04),
  0 1px 3px rgb(23 23 23 / 0.06);
```

Dark:

```css
box-shadow:
  0 1px 2px rgb(0 0 0 / 0.4),
  0 1px 3px rgb(0 0 0 / 0.5);
```

Most in-app surfaces are flat — header and content panes use a border, not a shadow. Avoid heavy drop shadows, glow, or neumorphism.

---

## 6. Motion

- Chevron rotate / small UI toggles: **150–200ms** ease (`cubic-bezier(0.16, 1, 0.3, 1)` acceptable).
- **Zero duration** for anything that reveals or hides the native web view — the native layer cannot animate with the DOM, so a transition only produces a flicker.
- No constant particle, pulse, or glow animations.

---

## 7. Surfaces

### App chrome (header, panes)

`bg-surface`, hairline `border-border` where panes meet. No blur, no transparency.

### Content pane (default)

`bg-surface`, own scroll container (`overflow-y-auto`). This is what the lesson overlay and most views use.

### Card (floating / onboarding)

```css
background: var(--gm-surface);
border: 1px solid var(--gm-border);
border-radius: 16px;
/* optional shadow-card on modals and dropdowns */
```

Tailwind: `rounded-2xl border border-border bg-surface p-6` — add `shadow-card` for modals and menus.

### Modal

- Overlay: `bg-overlay` — solid dim, no blur.
- Panel: `bg-surface`, `rounded-2xl`, `border-border`, `shadow-card`.
- Suppress the native web view while open; open and close with zero transition when over the view region.

### Toast

Top-right stack; `bg-surface` + `shadow-card`; semantic left border or icon (brand green success / danger / warning / info). Auto-dismiss ~4s, errors longer.

### Terminal pane

Black background, monospace, flush to the window edge. Not a theme surface — do not derive dark-mode tokens from it, and do not restyle xterm when the app theme changes.

### Canvas

`bg-canvas` for full-screen focus (onboarding). Light is bone `#f8f8f8`; dark is the site page colour `#212529`. Running app chrome is `bg-surface`.

### Tooltip

Inverted chip so it stays readable on both canvases: dark on light (`#171717` / `#ffffff`), light on dark (`#dee2e6` / `#212529`). Classes: `bg-tooltip text-tooltip-fg`.

---

## 8. Theme

One preference — Light, Dark, or System — in **Settings → Customise UI**. It themes both the Electron chrome and the embedded git-mastery.org pages.

| Preference | Chrome                         | Lesson pages                            |
| ---------- | ------------------------------ | --------------------------------------- |
| Light      | `data-theme="light"`           | `localStorage.markbind-theme = "light"` |
| Dark       | `data-theme="dark"`            | `localStorage.markbind-theme = "dark"`  |
| System     | follows `prefers-color-scheme` | key removed; MarkBind follows the OS    |

Rules:

- Apply `data-theme` and `color-scheme` on `<html>` **before paint** (inline script in `index.html`).
- Persist in renderer `site-view-prefs` and electron `config.json` (`theme`).
- Main process sets `nativeTheme.themeSource`, `BrowserWindow` background, and `WebContentsView` background (`#ffffff` / `#212529`) so loads do not flash the wrong colour.
- Saving reloads the embedded page so MarkBind’s `theme-manager.js` sees the new key.
- Do **not** add a second theme control, and do **not** use `dark:` utilities when a semantic token already swaps.

---

## 9. Tailwind v4 theme

Tailwind v4 has no JS config here. Brand scale and semantic aliases live in `@theme`; actual light/dark values live on `:root` / `html[data-theme="dark"]` as `--gm-*` variables.

```css
@import "tailwindcss";

@theme {
  --font-body: "Inter", system-ui, sans-serif;
  --font-heading: "Noto Serif", Georgia, serif;

  --color-brand-600: #2d864e;
  --color-canvas: var(--gm-canvas);
  --color-surface: var(--gm-surface);
  --color-fg: var(--gm-fg);
  --color-muted: var(--gm-muted);
  --color-border: var(--gm-border);
  --shadow-card: var(--gm-shadow-card);
}

:root {
  --gm-canvas: #f8f8f8;
  --gm-surface: #ffffff;
  --gm-fg: #333333;
}

html[data-theme="dark"] {
  --gm-canvas: #212529;
  --gm-surface: #212529;
  --gm-fg: #dee2e6;
}
```

Notes:

- Reach for `@theme` values in raw CSS as `var(--color-brand-600)` or `var(--gm-surface)` when a utility will not do.
- When removing legacy CSS layers from `index.css`, drop unused `@layer` entries in the same change.
