# Tours sidebar outline

The left tours panel is built from three catalogs plus each lesson's
`text.md`. It does not scrape lesson HTML.

| Source                                                       | Role                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `https://git-mastery.org/lessons/lessons.json`               | Tours and lessons, in page order                            |
| `https://git-mastery.org/exercises-directory/exercises.json` | Exercises, in the order they appear                         |
| `https://git-mastery.org/lessons/detours.json`               | Detours, keyed to a parent lesson                           |
| Each lesson's `text.md`                                      | Row order (`show_hop_prep`, `show_exercise`, `show_detour`) |

`custardui.config.json` has view toggles and label names, not a compulsory
flag. It is not fetched for the sidebar.

## Course edition overlay

When Settings → Customise has a course edition id (e.g. `cs2103`), the sidebar
fetches `https://git-mastery.org/versions/<id>/<id>.json` and reads
`preset.labels` only. Theme, toggles, and unknown keys are ignored. Any
edition that publishes a file at that path works; there is no allowlist.

This overlay is strictly additive. It never hides, reorders, or filters rows.

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
