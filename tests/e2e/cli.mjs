import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.env.GM_E2E_ROOT;
const exercise = path.join(root, "under-control");
const repository = path.join(exercise, "control-me");
const args = process.argv.slice(2);
const cwd = fs.realpathSync(process.cwd());
fs.appendFileSync(
  process.env.GM_E2E_CLI_LOG,
  JSON.stringify({ args, cwd }) + "\n",
);

if (args[0] === "download") {
  assert.deepEqual(args, ["download", "under-control"]);
  assert.equal(cwd, root);
  assert.equal(fs.existsSync(exercise), false, "Refuse a repeated download");
  fs.mkdirSync(repository, { recursive: true });
  fs.writeFileSync(
    path.join(exercise, ".gitmastery-exercise.json"),
    JSON.stringify({
      exercise_name: "under-control",
      exercise_repo: {
        repo_type: "local",
        repo_name: "control-me",
        init: false,
      },
    }),
  );
  console.log("INFO  Downloaded under-control");
} else if (args[0] === "verify") {
  assert.deepEqual(args, ["verify"]);
  assert.equal(cwd, repository);
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  // Allows a manual negative control without changing application code.
  assert.notEqual(process.env.GM_E2E_REJECT_VERIFY, "1", "Negative control");
  fs.writeFileSync(
    path.join(root, "progress", "progress.json"),
    JSON.stringify([{ exercise_name: "under-control", status: "Completed" }]),
  );
  console.log("INFO  Status: Completed");
} else {
  throw new Error(`Unexpected fixture CLI arguments: ${JSON.stringify(args)}`);
}
