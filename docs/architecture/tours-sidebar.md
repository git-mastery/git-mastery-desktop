# Tours sidebar outline

The left tours panel is built from three catalogs plus each lesson's
`text.md`. It does not scrape lesson HTML.

| Source                                                       | Role                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `https://git-mastery.org/lessons/lessons.json`               | Tours and lessons, in page order                            |
| `https://git-mastery.org/exercises-directory/exercises.json` | Exercises, in the order they appear                         |
| `https://git-mastery.org/lessons/detours.json`               | Detours, keyed to a parent lesson                           |
| Each lesson's `text.md`                                      | Row order (`show_hop_prep`, `show_exercise`, `show_detour`) |

`custardui.config.json` supplies section visibility defaults, not a compulsory
flag. The sidebar shares its cached fetch with Customise.

## Section visibility

Sidebar navigation follows the saved Customise choices for hands-on practicals,
exercises, and detours. Hidden rows remain in the outline but are greyed out and
disabled, including keyboard activation. Show and Peek remain navigable.
Exercises nested under a hidden detour are disabled even when Exercises is Show
or Peek, because their containing section is unavailable.

Visibility resolves per toggle: an explicit saved Show, Peek, or Hide choice wins,
then the course edition's `preset.toggles`, then the site's configured default.
A configured toggle with no default means Show, matching CustardUI. While a
fallback source is unavailable, rows stay enabled unless another available source
marks them hidden. Older page-only preferences are read through the existing
`getSitePrefs` bridge when there is no desktop copy.

Saving Customise emits `gm-site-view-prefs`; the sidebar subscribes and updates
without being reopened. Disabled rows do not receive active or hover styling.

## Course edition overlay

When Settings → Customise has a course edition id (e.g. `cs2103`), the sidebar
fetches `https://git-mastery.org/versions/<id>/<id>.json`. The label overlay reads
`preset.labels`; section visibility reads `preset.toggles` from the same cached
response. Theme and unknown keys are ignored. Any
edition that publishes a file at that path works; there is no allowlist.

The label overlay is strictly additive. It never hides, reorders, or filters rows.
Visibility changes whether a row can be activated, not its place in the outline.

| Fetch / parse result                           | Sidebar                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| No edition id                                  | Unchanged, including the **Optional** heuristic on detour exercises                                                           |
| 404, network error, non-JSON, or `id` mismatch | Same as no edition                                                                                                            |
| File loaded                                    | Marks from `preset.labels` only. Missing keys get none. The detour-exercise heuristic is off so it cannot contradict the file |

Label keys match CustardUI names:

- Lesson: `{tour.folder}.{lesson_name}` e.g. `recordingFolderHistory.init`
- Detour: detour key e.g. `undoRepoInit`
- Exercise: catalog key e.g. `under_control` (underscores)

Every `preset.labels` entry is an 11px chip with the configured `value`
(truncated to 24 characters). The sidebar does not special-case any word, so
a course that uses Compulsory, Required, or another label all render the same
way. Color letters map onto existing tokens, and green stays “done”, not a
requirement color:

- `r` → danger
- `g` → muted
- `b` → info
- anything else, or missing `color` → muted, still show `value`

Hands-on, tour intro, and tour outro have no keys in the edition file.

## Join rules

Inside a lesson, existing sidebar rows follow `text.md` marker order:

1. `show_hop_prep('hp-…')`, titled from the preceding
   `show_hands_on_practical`
2. `show_exercise(exercises.<catalogKey>)` when that key is a visible
   lesson exercise
3. `show_detour('<detourKey>')` when that key is in `detours.json`

`show_detour_preview` is ignored. Repeated hop identifiers keep the first
occurrence. Catalog entries with no matching marker are appended in JSON key
order so the sidebar does not drop content. If `text.md` cannot be fetched,
the outline is that grouped catalog fallback: lesson exercises, then detours.

`wip` exercises are omitted. An exercise with a `detour` nests under that
detour even if it also has a `lesson`; those nested exercises stay in catalog
order under the detour row. With no course edition loaded, nested exercises
are labeled **Optional**. Lesson exercises have no extra label until an
edition file supplies one.

## Navigation hashes

| Row      | Hash                                                   |
| -------- | ------------------------------------------------------ |
| Exercise | `#exercise-{identifier}`                               |
| Detour   | `#{detourKey}` (the `.gm-detour` id)                   |
| Hands-on | `#{practical title}` (the `.gm-hands-on-practical` id) |

Hands-on titles come from `show_hands_on_practical("…")`. If a prep call has
no surrounding practical, the hash falls back to `#hands-on-{identifier}`,
which the page injector writes onto the Start Hands-on wrapper.
