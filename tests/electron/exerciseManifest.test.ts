import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EXERCISE_MANIFEST_NAME,
  isPathSegment,
  readExerciseManifest,
  resolveExerciseCwd,
} from "../../src/electron/exerciseManifest.js";

const manifest = (
  repoType: "local" | "local-ignore" | "remote" | "ignore",
  repoName = "repo",
) => ({
  exercise_name: "example",
  exercise_repo: {
    repo_type: repoType,
    repo_name: repoName,
  },
});

describe("isPathSegment", () => {
  it("accepts a single directory name", () => {
    expect(isPathSegment("exercise-repo")).toBe(true);
  });

  it.each(["", ".", "..", "nested/repo", String.raw`nested\repo`])(
    "rejects unsafe segment %j",
    (value) => {
      expect(isPathSegment(value)).toBe(false);
    },
  );

  it("rejects absolute paths", () => {
    expect(isPathSegment(path.resolve("exercise-repo"))).toBe(false);
  });
});

describe("exercise manifest resolution", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-manifest-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const writeManifest = (value: unknown) => {
    fs.writeFileSync(
      path.join(directory, EXERCISE_MANIFEST_NAME),
      JSON.stringify(value),
      "utf8",
    );
  };

  it("reads a valid manifest", () => {
    writeManifest(manifest("local"));

    expect(readExerciseManifest(directory)).toEqual(manifest("local"));
  });

  it.each([
    ["invalid JSON", "{"],
    [
      "missing repository name",
      JSON.stringify({
        exercise_name: "example",
        exercise_repo: { repo_type: "local" },
      }),
    ],
    [
      "unknown repository type",
      JSON.stringify({
        exercise_name: "example",
        exercise_repo: { repo_type: "unknown", repo_name: "repo" },
      }),
    ],
  ])("returns null for %s", (_label, contents) => {
    fs.writeFileSync(
      path.join(directory, EXERCISE_MANIFEST_NAME),
      contents,
      "utf8",
    );

    expect(readExerciseManifest(directory)).toBeNull();
  });

  it("distinguishes a missing download from a corrupt path", () => {
    const missing = path.join(directory, "missing");
    const file = path.join(directory, "not-a-directory");
    fs.writeFileSync(file, "content", "utf8");

    expect(resolveExerciseCwd(missing)).toEqual({
      state: "not-downloaded",
    });
    expect(resolveExerciseCwd(file)).toEqual({
      state: "corrupt",
      exerciseRoot: file,
    });
  });

  it("uses the exercise root for an ignore repository", () => {
    writeManifest(manifest("ignore", "unused"));

    expect(resolveExerciseCwd(directory)).toEqual({
      state: "ready",
      cwd: directory,
    });
  });

  it("uses the repository directory named by the manifest", () => {
    const repo = path.join(directory, "repo");
    fs.mkdirSync(repo);
    writeManifest(manifest("local"));

    expect(resolveExerciseCwd(directory)).toEqual({
      state: "ready",
      cwd: repo,
    });
  });

  it("reports an interrupted download when the repository is missing", () => {
    writeManifest(manifest("remote"));

    expect(resolveExerciseCwd(directory)).toEqual({
      state: "incomplete",
      exerciseRoot: directory,
    });
  });

  it("rejects an unsafe or non-directory repository target", () => {
    writeManifest(manifest("local", "../outside"));
    expect(resolveExerciseCwd(directory)).toEqual({
      state: "corrupt",
      exerciseRoot: directory,
    });

    writeManifest(manifest("local"));
    fs.writeFileSync(path.join(directory, "repo"), "content", "utf8");
    expect(resolveExerciseCwd(directory)).toEqual({
      state: "corrupt",
      exerciseRoot: directory,
    });
  });
});

describe("hands-on directory resolution", () => {
  let parent: string;
  let directory: string;

  beforeEach(() => {
    parent = fs.mkdtempSync(path.join(os.tmpdir(), "git-mastery-hands-on-"));
    directory = path.join(parent, "hp-example");
    fs.mkdirSync(directory);
  });

  afterEach(() => {
    fs.rmSync(parent, { recursive: true, force: true });
  });

  it("reports an empty hands-on download as incomplete", () => {
    expect(resolveExerciseCwd(directory)).toEqual({
      state: "incomplete",
      exerciseRoot: directory,
    });
  });

  it("uses the only visible subdirectory as the working directory", () => {
    const repo = path.join(directory, "things");
    fs.mkdirSync(repo);
    fs.mkdirSync(path.join(directory, ".metadata"));

    expect(resolveExerciseCwd(directory)).toEqual({
      state: "ready",
      cwd: repo,
    });
  });

  it("uses the root when there is not exactly one visible subdirectory", () => {
    fs.mkdirSync(path.join(directory, "one"));
    fs.mkdirSync(path.join(directory, "two"));

    expect(resolveExerciseCwd(directory)).toEqual({
      state: "ready",
      cwd: directory,
    });
  });
});
