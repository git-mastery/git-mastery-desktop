import path from "path";

export type GitDerivedInput = {
  repoDisplay: string;
  cwdDisplay: string;
  repoAbs: string;
  cwdAbs: string;
  status: string | null;
  headSubject: string | null;
  inProgress: string[];
  mergeIncoming: string | null;
};

function placement(repoAbs: string, cwdAbs: string): string {
  if (path.resolve(repoAbs) === path.resolve(cwdAbs)) {
    return "this is the working folder";
  }
  const toCwd = path.relative(repoAbs, cwdAbs);
  if (toCwd && !toCwd.startsWith("..") && !path.isAbsolute(toCwd)) {
    return "parent of the working folder";
  }
  const toRepo = path.relative(cwdAbs, repoAbs);
  if (toRepo && !toRepo.startsWith("..") && !path.isAbsolute(toRepo)) {
    return "inside the working folder";
  }
  return "elsewhere in the exercise folder";
}

function branchLine(status: string | null): string | null {
  if (!status) return null;
  const line = status.split(/\r?\n/).find((row) => row.startsWith("## "));
  return line ? line.slice(3).trim() : null;
}

function headFact(branch: string | null, subject: string | null): string {
  const subjectBit = subject ? `; latest commit subject: ${subject}` : "";
  if (!branch) {
    return subject
      ? `HEAD: unknown branch; latest commit subject: ${subject}`
      : "HEAD: unknown";
  }
  if (branch === "HEAD (no branch)" || branch.startsWith("HEAD (no branch)")) {
    return `HEAD: detached${subjectBit}`;
  }
  const noCommits = /^No commits yet on (.+)$/.exec(branch);
  if (noCommits) {
    return `HEAD: on branch ${noCommits[1]} (no commits yet)`;
  }
  const name = branch.split("...")[0]?.trim() || branch;
  return `HEAD: on branch ${name}${subjectBit}`;
}

function isConflictStatus(xy: string): boolean {
  return xy.includes("U") || xy === "AA" || xy === "DD";
}

function workingTreeFact(status: string | null): string {
  if (!status) return "Working tree: unknown";
  const files = status
    .split(/\r?\n/)
    .filter((row) => row.length >= 3 && !row.startsWith("## "));
  if (files.length === 0) return "Working tree: clean";
  const conflicted: string[] = [];
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  for (const row of files) {
    const xy = row.slice(0, 2);
    const name =
      row.slice(3).split(" -> ").pop()?.trim() || row.slice(3).trim();
    if (isConflictStatus(xy)) conflicted.push(name);
    else if (xy === "??") untracked += 1;
    else {
      if (xy[0] !== " " && xy[0] !== "?") staged += 1;
      if (xy[1] !== " " && xy[1] !== "?") unstaged += 1;
    }
  }
  if (conflicted.length > 0) {
    const shown = conflicted.slice(0, 4).join(", ");
    const extra =
      conflicted.length > 4 ? ` (+${conflicted.length - 4} more)` : "";
    return `Working tree: conflicted (${shown}${extra})`;
  }
  const bits = [
    staged > 0 ? `${staged} staged` : null,
    unstaged > 0 ? `${unstaged} unstaged` : null,
    untracked > 0 ? `${untracked} untracked` : null,
  ].filter((bit): bit is string => bit !== null);
  return `Working tree: dirty (${bits.join(", ")})`;
}

/**
 * Conservative structural summary of one repository. Omits anything that
 * cannot be read from porcelain, HEAD subject, and in-progress markers.
 */
export function formatDerivedFacts(input: GitDerivedInput): string {
  const lines = [
    `Working folder: ${input.cwdDisplay}`,
    `Repository: ${input.repoDisplay} (${placement(input.repoAbs, input.cwdAbs)})`,
    headFact(branchLine(input.status), input.headSubject),
    workingTreeFact(input.status),
  ];
  if (input.inProgress.length > 0) {
    lines.push(
      `Operation: ${input.inProgress.join(", ")} (paused, not yet finished or aborted)`,
    );
  } else {
    lines.push("Operation: none paused");
  }
  const current = branchLine(input.status)?.split("...")[0]?.trim();
  if (
    input.mergeIncoming &&
    current &&
    current !== "HEAD (no branch)" &&
    input.mergeIncoming !== current
  ) {
    lines.push(`Merge: bringing ${input.mergeIncoming} into ${current}`);
  }
  return `Derived facts (read these first; raw commands below are evidence):\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
