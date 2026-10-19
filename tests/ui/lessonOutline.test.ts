import { describe, expect, it } from "vitest";
import type { Detours } from "../../src/types/Detour.js";
import type { Exercise, Exercises } from "../../src/types/Exercise.js";
import type { Lesson } from "../../src/types/Tour.js";
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

describe("buildLessonOutline", () => {
  it("orders hands-on work before visible lesson exercises", () => {
    const exercises: Exercises = {
      first: exercise("first", "commits"),
      hidden: exercise("hidden", "commits", { wip: 1 }),
      otherLesson: exercise("other-lesson", "branches"),
      second: exercise("second", "commits"),
    };

    const outline = buildLessonOutline("commits", exercises, undefined, [
      {
        identifier: "hp-first",
        title: "First practical",
        panelId: null,
      },
      {
        identifier: "hp-second",
        title: "Second practical",
        panelId: "custom-panel",
      },
    ]);

    expect(outline).toEqual([
      {
        kind: "hands-on",
        identifier: "hp-first",
        title: "First practical",
        panelId: "hands-on-hp-first",
      },
      {
        kind: "hands-on",
        identifier: "hp-second",
        title: "Second practical",
        panelId: "custom-panel",
      },
      {
        kind: "exercise",
        catalogKey: "first",
        exercise: exercises.first,
      },
      {
        kind: "exercise",
        catalogKey: "second",
        exercise: exercises.second,
      },
    ]);
  });

  it("groups exercises under matching detours in catalog order", () => {
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
      buildLessonOutline("commits", exercises, detours, undefined),
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
