import { describe, expect, it } from "vitest";
import {
  fallbackWorkspaceTitle,
  lessonSource,
  parseAiSource,
  parseChatGptQuery,
  parseLessonNameFromUrl,
  workspaceKindOf,
  workspaceSource,
} from "../../../src/electron/ai/source.js";

describe("workspace sources", () => {
  it("classifies and titles hands-on workspaces", () => {
    expect(workspaceKindOf("hp-first-repository")).toBe("hands-on");
    expect(fallbackWorkspaceTitle("hp-first-repository")).toBe(
      "First repository",
    );
    expect(workspaceSource("hp-first-repository")).toEqual({
      sourceKey: "hands-on:hp-first-repository",
      kind: "hands-on",
      id: "hp-first-repository",
      title: "First repository",
    });
  });

  it("keeps ordinary exercises distinct from hands-on workspaces", () => {
    expect(workspaceKindOf("commit-one-file")).toBe("exercise");
    expect(workspaceSource("commit-one-file", "Commit one file")).toEqual({
      sourceKey: "exercise:commit-one-file",
      kind: "exercise",
      id: "commit-one-file",
      title: "Commit one file",
    });
  });
});

describe("parseAiSource", () => {
  it.each([
    lessonSource("commits", "Commits"),
    workspaceSource("commit-one-file", "Commit one file"),
    workspaceSource("hp-first-repository", "First repository"),
  ])("accepts a valid $kind source", (source) => {
    expect(parseAiSource(source)).toEqual(source);
  });

  it.each([
    null,
    {},
    {
      sourceKey: "lesson:commits",
      kind: "exercise",
      id: "commits",
      title: "Commits",
    },
    {
      sourceKey: "exercise:hp-first-repository",
      kind: "exercise",
      id: "hp-first-repository",
      title: "First repository",
    },
    {
      sourceKey: "hands-on:commit-one-file",
      kind: "hands-on",
      id: "commit-one-file",
      title: "Commit one file",
    },
    {
      sourceKey: "lesson:../commits",
      kind: "lesson",
      id: "../commits",
      title: "Commits",
    },
    {
      sourceKey: "lesson:",
      kind: "lesson",
      id: "",
      title: "Empty",
    },
  ])("rejects an invalid or inconsistent source", (source) => {
    expect(parseAiSource(source)).toBeNull();
  });
});

describe("parseLessonNameFromUrl", () => {
  it.each([
    ["https://git-mastery.org/lessons/commits", "commits"],
    ["https://git-mastery.org/lessons/commits/", "commits"],
    ["https://git-mastery.org/lessons/commits/index.html", "commits"],
  ])("parses %s", (url, expected) => {
    expect(parseLessonNameFromUrl(url)).toBe(expected);
  });

  it.each([
    "not a URL",
    "https://git-mastery.org/",
    "https://git-mastery.org/lessons/trail",
    "https://git-mastery.org/lessons/commits/extra",
    "https://git-mastery.org/tours/commits",
  ])("rejects unsupported lesson URL %s", (url) => {
    expect(parseLessonNameFromUrl(url)).toBeNull();
  });
});

describe("parseChatGptQuery", () => {
  it("returns and trims the supported query", () => {
    expect(
      parseChatGptQuery("https://chatgpt.com/?q=%20Explain+git+status%20"),
    ).toBe("Explain git status");
  });

  it.each([
    "not a URL",
    "http://chatgpt.com/?q=Explain+git",
    "https://example.com/?q=Explain+git",
    "https://chatgpt.com/c/example?q=Explain+git",
    "https://chatgpt.com/",
    "https://chatgpt.com/?q=%20%20",
  ])("rejects unsupported prompt URL %s", (url) => {
    expect(parseChatGptQuery(url)).toBeNull();
  });
});
