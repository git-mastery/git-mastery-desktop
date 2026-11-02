import { describe, expect, it } from "vitest";
import type { Detours } from "../../src/types/Detour.js";
import type { Exercise, Exercises } from "../../src/types/Exercise.js";
import type { Lesson } from "../../src/types/Tour.js";
import { parseLessonMarkers } from "../../src/ui/utils/lessonMarkers.js";
import { buildLessonOutline } from "../../src/ui/utils/lessonOutline.js";

const lesson = (lessonName: string): Lesson => ({
  title: lessonName,
  tour_name: "tour",
  lesson_name: lessonName,
});

const exercise = (
  identifier: string,
  lessonName: string,
  extra: Partial<Exercise> = {},
): Exercise => ({
  identifier,
  lesson: lesson(lessonName),
  ...extra,
});

describe("parseLessonMarkers", () => {
  it("orders hop, exercise, and detour calls and ignores previews and duplicates", () => {
    const markdown = `{% from "common/macros.njk" import show_detour, show_detour_preview, show_exercise, show_hands_on_practical, show_hop_prep %}

{% call show_hands_on_practical("First practical") %}
{{ show_hop_prep('hp-first') }}
{% endcall %}

{{ show_exercise(exercises.first) }}
{{ show_detour_preview('updateLastCommit') }}
{{ show_detour('amend') }}

{% call show_hands_on_practical("Second practical") %}
{{ show_hop_prep("hp-second", is_continue=1) }}
{{ show_hop_prep('hp-first') }}
{% endcall %}

{{ show_exercise(
  exercises.second
) }}
{{ show_detour(
  "recovery",
  detour_title="Recovering commits"
) }}
`;

    expect(parseLessonMarkers(markdown)).toEqual([
      {
        kind: "hands-on",
        identifier: "hp-first",
        title: "First practical",
        panelId: "First practical",
      },
      { kind: "exercise", catalogKey: "first" },
      { kind: "detour", detourKey: "amend" },
      {
        kind: "hands-on",
        identifier: "hp-second",
        title: "Second practical",
        panelId: "Second practical",
      },
      { kind: "exercise", catalogKey: "second" },
      { kind: "detour", detourKey: "recovery" },
    ]);
  });

  it("falls back to a formatted identifier when a prep has no surrounding practical", () => {
    expect(parseLessonMarkers("{{ show_hop_prep('hp-init-repo') }}")).toEqual([
      {
        kind: "hands-on",
        identifier: "hp-init-repo",
        title: "Init Repo",
        panelId: null,
      },
    ]);
  });
});

describe("buildLessonOutline", () => {
  it("interleaves marker order and nests detour exercises from the catalog", () => {
    const detours: Detours = {
      amend: {
        lesson: lesson("commits"),
        title: "Amending commits",
      },
      recovery: {
        lesson: lesson("commits"),
        title: "Recovering commits",
      },
    };
    const exercises: Exercises = {
      first: exercise("first", "commits"),
      hidden: exercise("hidden", "commits", { wip: 1 }),
      otherLesson: exercise("other-lesson", "branches"),
      amendExercise: exercise("amend", "commits", {
        detour: {
          lesson: lesson("commits"),
          title: "Amending commits",
        },
      }),
      second: exercise("second", "commits"),
    };

    const outline = buildLessonOutline("commits", exercises, detours, [
      {
        kind: "hands-on",
        identifier: "hp-first",
        title: "First practical",
        panelId: null,
      },
      { kind: "exercise", catalogKey: "first" },
      { kind: "exercise", catalogKey: "hidden" },
      { kind: "detour", detourKey: "amend" },
      {
        kind: "hands-on",
        identifier: "hp-second",
        title: "Second practical",
        panelId: "custom-panel",
      },
      { kind: "exercise", catalogKey: "second" },
    ]);

    expect(outline).toEqual([
      {
        kind: "hands-on",
        identifier: "hp-first",
        title: "First practical",
        panelId: "hands-on-hp-first",
      },
      {
        kind: "exercise",
        catalogKey: "first",
        exercise: exercises.first,
      },
      {
        kind: "detour",
        detourKey: "amend",
        title: "Amending commits",
        exercises: [
          {
            catalogKey: "amendExercise",
            exercise: exercises.amendExercise,
          },
        ],
      },
      {
        kind: "hands-on",
        identifier: "hp-second",
        title: "Second practical",
        panelId: "custom-panel",
      },
      {
        kind: "exercise",
        catalogKey: "second",
        exercise: exercises.second,
      },
      {
        kind: "detour",
        detourKey: "recovery",
        title: "Recovering commits",
        exercises: [],
      },
    ]);
  });

  it("appends unmatched catalog rows in catalog order", () => {
    const exercises: Exercises = {
      first: exercise("first", "commits"),
      second: exercise("second", "commits"),
    };

    expect(
      buildLessonOutline("commits", exercises, undefined, [
        { kind: "exercise", catalogKey: "second" },
        { kind: "exercise", catalogKey: "missing" },
      ]),
    ).toEqual([
      {
        kind: "exercise",
        catalogKey: "second",
        exercise: exercises.second,
      },
      {
        kind: "exercise",
        catalogKey: "first",
        exercise: exercises.first,
      },
    ]);
  });

  it("groups exercises under matching detours in catalog order when source is unavailable", () => {
    const detours: Detours = {
      amend: {
        lesson: lesson("commits"),
        title: "Amending commits",
      },
      branches: {
        lesson: lesson("branches"),
        title: "Branch detour",
      },
      recovery: {
        lesson: lesson("commits"),
        title: "Recovering commits",
      },
    };
    const exercises: Exercises = {
      recoveryExercise: exercise("recover", "commits", {
        detour: {
          lesson: lesson("commits"),
          title: "Recovering commits",
        },
      }),
      amendExercise: exercise("amend", "commits", {
        detour: {
          lesson: lesson("commits"),
          title: "Amending commits",
        },
      }),
    };

    expect(
      buildLessonOutline("commits", exercises, detours, undefined),
    ).toEqual([
      {
        kind: "detour",
        detourKey: "amend",
        title: "Amending commits",
        exercises: [
          {
            catalogKey: "amendExercise",
            exercise: exercises.amendExercise,
          },
        ],
      },
      {
        kind: "detour",
        detourKey: "recovery",
        title: "Recovering commits",
        exercises: [
          {
            catalogKey: "recoveryExercise",
            exercise: exercises.recoveryExercise,
          },
        ],
      },
    ]);
  });

  it("does not promote orphaned or mismatched detour exercises", () => {
    const detours: Detours = {
      known: {
        lesson: lesson("commits"),
        title: "Known detour",
      },
    };
    const exercises: Exercises = {
      orphaned: exercise("orphaned", "commits", {
        detour: {
          lesson: lesson("commits"),
          title: "Missing detour",
        },
      }),
      wrongLesson: exercise("wrong-lesson", "branches", {
        detour: {
          lesson: lesson("branches"),
          title: "Known detour",
        },
      }),
    };

    expect(
      buildLessonOutline("commits", exercises, detours, [
        { kind: "exercise", catalogKey: "orphaned" },
      ]),
    ).toEqual([
      {
        kind: "detour",
        detourKey: "known",
        title: "Known detour",
        exercises: [],
      },
    ]);
  });

  it("returns an empty outline when catalogs are unavailable", () => {
    expect(
      buildLessonOutline("commits", undefined, undefined, undefined),
    ).toEqual([]);
  });
});
