import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./harness";

test("Start downloads once and resumes without losing terminal work", async ({
  desktop,
}) => {
  await desktop.onboard();
  await desktop.start();
  await expect(desktop.exerciseRow()).toContainText("Downloaded");
  expect(desktop.calls()).toEqual([
    { args: ["download", "under-control"], cwd: desktop.root },
  ]);
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(desktop.root, "under-control", ".gitmastery-exercise.json"),
        "utf8",
      ),
    ).exercise_repo.repo_name,
  ).toBe("control-me");
  const sentinel = path.join(desktop.repository, "my-work.txt");
  await desktop.typeCommand("printf 'learner work' > my-work.txt");
  await expect.poll(() => fs.existsSync(sentinel)).toBe(true);
  // Move away first, so resuming must perform a real cd a second time.
  await desktop.typeCommand("cd ../..; printf away > away.txt");
  await expect
    .poll(() => fs.existsSync(path.join(desktop.root, "away.txt")))
    .toBe(true);
  await desktop.start();
  await desktop.typeCommand("printf resumed > resumed.txt");
  await expect
    .poll(() => fs.existsSync(path.join(desktop.repository, "resumed.txt")))
    .toBe(true);
  expect(fs.readFileSync(sentinel, "utf8")).toBe("learner work");
  expect(desktop.calls()).toEqual([
    { args: ["download", "under-control"], cwd: desktop.root },
  ]);
});

test("Verify a terminal solution and restore exercise completion after restart", async ({
  desktop,
}) => {
  test.skip(
    process.platform === "win32",
    "Production Windows cwd probe is not implemented.",
  );
  await desktop.onboard();
  await desktop.start();
  await desktop.typeCommand("git init");
  await expect
    .poll(() => fs.existsSync(path.join(desktop.repository, ".git")))
    .toBe(true);
  const lesson = await desktop.lessonPage();
  await lesson.locator('[data-gm-verify="under-control"]').click();
  await expect(
    desktop.page.getByText("Exercise answer correct", { exact: true }),
  ).toBeVisible();
  await expect(desktop.exerciseRow()).toContainText("Completed");
  expect(desktop.calls()).toEqual([
    { args: ["download", "under-control"], cwd: desktop.root },
    { args: ["verify"], cwd: desktop.repository },
  ]);
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(desktop.root, "progress", "progress.json"),
        "utf8",
      ),
    ),
  ).toEqual([{ exercise_name: "under-control", status: "Completed" }]);
  await expect(
    desktop.page.getByRole("button", {
      name: "Mark Fixture lesson as done",
      exact: true,
    }),
  ).toBeVisible();
  await desktop.restart();
  await expect(desktop.exerciseRow()).toContainText("Completed");
  await expect(
    desktop.page.getByRole("button", {
      name: "Mark Fixture lesson as done",
      exact: true,
    }),
  ).toBeVisible();
  expect(desktop.calls()).toHaveLength(2);
});

test("Windows Verify reports the missing cwd capability without invoking CLI verification", async ({
  desktop,
}) => {
  test.skip(
    process.platform !== "win32",
    "Windows-specific application limitation.",
  );
  await desktop.onboard();
  await desktop.start();
  await desktop.typeCommand("git init");
  await expect
    .poll(() => fs.existsSync(path.join(desktop.repository, ".git")))
    .toBe(true);
  const lesson = await desktop.lessonPage();
  await lesson.locator('[data-gm-verify="under-control"]').click();
  await expect(
    desktop.page.getByRole("heading", { name: "Not in the exercise folder" }),
  ).toBeVisible();
  await desktop.page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(desktop.exerciseRow()).toContainText("Downloaded");
  expect(desktop.calls()).toEqual([
    { args: ["download", "under-control"], cwd: desktop.root },
  ]);
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(desktop.root, "progress", "progress.json"),
        "utf8",
      ),
    ),
  ).toEqual([]);
});

test("Manual lesson completion survives restart independently of exercises", async ({
  desktop,
}) => {
  await desktop.onboard();
  await desktop.page
    .getByRole("button", { name: "Mark Fixture lesson as done", exact: true })
    .click();
  for (let launch = 0; launch < 2; launch++) {
    await expect(
      desktop.page.getByRole("button", {
        name: "Mark Fixture lesson as not done",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      desktop.page.getByRole("progressbar", {
        name: "1 of 1 lessons completed",
      }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(
      await desktop.page.evaluate(() =>
        JSON.parse(localStorage.getItem("gm-lessons-done") ?? "null"),
      ),
    ).toEqual(["init"]);
    if (launch === 0) await desktop.restart();
  }
  expect(desktop.calls()).toEqual([]);
  expect(fs.existsSync(path.join(desktop.root, "under-control"))).toBe(false);
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(desktop.root, "progress", "progress.json"),
        "utf8",
      ),
    ),
  ).toEqual([]);
});
