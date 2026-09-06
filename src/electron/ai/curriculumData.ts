// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/generate-curriculum.mjs
//
// Source: https://raw.githubusercontent.com/git-mastery/git-mastery.github.io/master/.claude/skills/concepts-review/references/git-mastery-lesson-sequence.md
//
// The canonical Git-Mastery lesson sequence. This is the only source of lesson
// information used by the AI hints feature — position, title, and the concepts
// a student may rely on at that point. exercises.json is consulted separately,
// and only to answer "which lesson is this exercise in".

export type LessonEntry = {
  /** Course position, e.g. "T1L4". */
  pos: string;
  tour: number;
  lesson: number;
  title: string;
  /** Concepts the student can rely on once this lesson is done. */
  concepts: string;
};

/** Keyed by `lesson_name`, which is the join key exercises.json provides. */
export const LESSONS: Record<string, LessonEntry> = {
  intro: {
    pos: "T1L1",
    tour: 1,
    lesson: 1,
    title: "Introduction to Revision Control",
    concepts:
      "Revision control purpose; snapshots/history; collaboration motivation; Git as a revision-control system; GitHub as a hosting/collaboration platform at a high level.",
  },
  gitPrep: {
    pos: "T1L2",
    tour: 1,
    lesson: 2,
    title: "Preparing to Use Git",
    concepts:
      "Installing Git/Sourcetree; configuring user identity; command-line basics needed for the course; exercise folder conventions.",
  },
  init: {
    pos: "T1L3",
    tour: 1,
    lesson: 3,
    title: "Putting a Folder Under Git's Control",
    concepts:
      "Repository initialization; `.git` folder; working tree; repository root; tracked context at a beginner level; avoiding file-sync conflicts.",
  },
  stage: {
    pos: "T1L4",
    tour: 1,
    lesson: 4,
    title: "Specifying What to Include in a Snapshot",
    concepts:
      "Modified/new files; staging area/index; staging selected files; unstaging as optional detour; staged versus unstaged changes.",
  },
  commit: {
    pos: "T1L5",
    tour: 1,
    lesson: 5,
    title: "Saving a Snapshot",
    concepts:
      "Commit as a saved snapshot; commit message; staged changes become commit contents; deleting files and staging deletions as an optional detail.",
  },
  log: {
    pos: "T1L6",
    tour: 1,
    lesson: 6,
    title: "Examining the Revision History",
    concepts:
      "Commit history; commit identifiers; chronological/log views; revision graph at a basic level.",
  },
  remoteRepos: {
    pos: "T2L1",
    tour: 2,
    lesson: 1,
    title: "Remote Repositories",
    concepts:
      "Local versus remote repositories; cloud backup/sharing motivation; GitHub-hosted repositories.",
  },
  githubPrep: {
    pos: "T2L2",
    tour: 2,
    lesson: 2,
    title: "Preparing to use GitHub",
    concepts:
      "GitHub account/setup; authentication as needed by the course; GitHub UI orientation.",
  },
  createRemoteRepo: {
    pos: "T2L3",
    tour: 2,
    lesson: 3,
    title: "Creating a Repo on GitHub",
    concepts:
      "Creating an empty GitHub repository; repository visibility and initial remote repo state.",
  },
  setRemote: {
    pos: "T2L4",
    tour: 2,
    lesson: 4,
    title: "Linking a Local Repo With a Remote Repo",
    concepts:
      "Remotes; remote names such as `origin`; remote URLs; linking an existing local repo to a remote.",
  },
  push: {
    pos: "T2L5",
    tour: 2,
    lesson: 5,
    title: "Updating the Remote Repo",
    concepts:
      "Push; uploading local commits to a remote; local branch ahead of remote; remote-tracking branches introduced through `origin/main`; first and subsequent pushes; pushing to multiple remotes as an optional detour.",
  },
  ignore: {
    pos: "T2L6",
    tour: 2,
    lesson: 6,
    title: "Omitting Files from Revision Control",
    concepts:
      "`.gitignore`; ignored versus tracked files; ignore patterns; limitations for already-tracked files.",
  },
  fork: {
    pos: "T3L1",
    tour: 3,
    lesson: 1,
    title: "Duplicating a Remote Repo on the Cloud",
    concepts:
      "Forking on GitHub; copy of a remote repository under another account; fork relationship at a beginner level.",
  },
  clone: {
    pos: "T3L2",
    tour: 3,
    lesson: 2,
    title: "Creating a Local Copy of a Repo",
    concepts:
      "Clone; local copy from remote; `origin` created by clone; local working copy from cloud-hosted project.",
  },
  pull: {
    pos: "T3L3",
    tour: 3,
    lesson: 3,
    title: "Downloading Data Into a Local Repo",
    concepts:
      "Fetch/pull at a practical level; downloading remote commits; local repo synchronization; pulling from multiple remotes as optional.",
  },
  show: {
    pos: "T4L1",
    tour: 4,
    lesson: 1,
    title: "Examining a Commit",
    concepts:
      "Inspecting a commit; commit metadata and patch; aliases as optional convenience.",
  },
  tag: {
    pos: "T4L2",
    tour: 4,
    lesson: 2,
    title: "Tagging Commits",
    concepts:
      "Tags as names for commits; lightweight/practical tag use; updating/deleting/pushing tags as relevant.",
  },
  diff: {
    pos: "T4L3",
    tour: 4,
    lesson: 3,
    title: "Comparing Points of History",
    concepts:
      "Diff between working tree, staging area, commits, and files; interpreting additions/removals.",
  },
  checkout: {
    pos: "T4L4",
    tour: 4,
    lesson: 4,
    title: "Traversing to a Specific Commit",
    concepts:
      "Checking out commits; detached HEAD at a practical level; restoring/traversing history; stashing/conflicting uncommitted changes as optional detours.",
  },
  reset: {
    pos: "T4L5",
    tour: 4,
    lesson: 5,
    title: "Rewriting History to Start Over",
    concepts:
      "Reset modes at course depth; moving branch/HEAD; discarding or preserving changes; undoing recent commits; remote-tracking reset as optional.",
  },
  revert: {
    pos: "T4L6",
    tour: 4,
    lesson: 6,
    title: "Reverting a Specific Commit",
    concepts:
      "Revert as a new commit that undoes earlier changes; contrast with reset for shared history.",
  },
  selectiveStage: {
    pos: "T5L1",
    tour: 5,
    lesson: 1,
    title: "Controlling What Goes Into a Commit",
    concepts: "Partial staging; staging hunks/lines; crafting focused commits.",
  },
  commitMessage: {
    pos: "T5L2",
    tour: 5,
    lesson: 2,
    title: "Writing Good Commit Messages",
    concepts:
      "Commit-message conventions; subject/body; explaining why a change exists.",
  },
  interactiveRebase: {
    pos: "T5L3",
    tour: 5,
    lesson: 3,
    title: "Reorganising Commits",
    concepts:
      "Interactive rebase; reorder/squash/reword/drop commits; amending last commit as optional detour.",
  },
  branch: {
    pos: "T6L1",
    tour: 6,
    lesson: 1,
    title: "Creating Branches",
    concepts:
      "Branch refs; `main`/feature branches; switching branches; HEAD and current branch; local branch versus `origin/main` revisited.",
  },
  merge: {
    pos: "T6L2",
    tour: 6,
    lesson: 2,
    title: "Merging Branches",
    concepts:
      "Merge; fast-forward versus merge commit; comparing branches; squash merge and undo merge as optional.",
  },
  mergeConflicts: {
    pos: "T6L3",
    tour: 6,
    lesson: 3,
    title: "Resolving Merge Conflicts",
    concepts:
      "Conflict causes; conflict markers; resolving and committing a merge conflict.",
  },
  branchRename: {
    pos: "T6L4",
    tour: 6,
    lesson: 4,
    title: "Renaming Branches",
    concepts: "Local branch rename and related practical consequences.",
  },
  branchDelete: {
    pos: "T6L5",
    tour: 6,
    lesson: 5,
    title: "Deleting Branches",
    concepts:
      "Deleting local branches; safe deletion after merge; risks of deleting unmerged work.",
  },
  worktrees: {
    pos: "T6L6",
    tour: 6,
    lesson: 6,
    title: "Working on Multiple Branches with Worktrees",
    concepts:
      "Git worktrees; multiple working directories for one local repository; linked worktrees with separate working directories, staging areas, and `HEAD`s; shared history and branch refs; cleanup of linked worktrees.",
  },
  syncByMerge: {
    pos: "T7L1",
    tour: 7,
    lesson: 1,
    title: "Merging to Sync Branches",
    concepts:
      "Keeping branches updated by merging from another branch; integration tradeoffs.",
  },
  syncByRebase: {
    pos: "T7L2",
    tour: 7,
    lesson: 2,
    title: "Rebasing to Sync Branches",
    concepts:
      "Rebase for synchronization; replaying commits; linear history; when not to rebase shared work.",
  },
  cherryPick: {
    pos: "T7L3",
    tour: 7,
    lesson: 3,
    title: "Copying Specific Commits",
    concepts:
      "Cherry-pick; copying selected commits across branches; duplicate-change implications.",
  },
  remoteBranchPush: {
    pos: "T8L1",
    tour: 8,
    lesson: 1,
    title: "Pushing Branches to a Remote",
    concepts:
      "Publishing local branches; upstream/tracking setup; remote branch creation; remote-tracking branches further elaborated for non-default branches.",
  },
  remoteBranchPull: {
    pos: "T8L2",
    tour: 8,
    lesson: 2,
    title: "Pulling Branches from a Remote",
    concepts:
      "Fetching/pulling remote branches; remote-tracking branches as read-only references; local branch from remote branch; tracking branch workflows.",
  },
  remoteBranchDelete: {
    pos: "T8L3",
    tour: 8,
    lesson: 3,
    title: "Deleting Branches from a Remote",
    concepts:
      "Deleting remote branches; pruning/remote-tracking cleanup at course depth.",
  },
  remoteBranchRename: {
    pos: "T8L4",
    tour: 8,
    lesson: 4,
    title: "Renaming Branches in a Remote",
    concepts:
      "Remote branch rename workflow as create-new/delete-old; updating collaborators.",
  },
  prsCreate: {
    pos: "T9L1",
    tour: 9,
    lesson: 1,
    title: "Creating Pull Requests",
    concepts:
      "Pull requests; source/target branch; PR from main or other branches; resolving PR conflicts as optional.",
  },
  prsReview: {
    pos: "T9L2",
    tour: 9,
    lesson: 2,
    title: "Reviewing Pull Requests",
    concepts:
      "Code review through PRs; comments, approvals, requested changes.",
  },
  prsMerge: {
    pos: "T9L3",
    tour: 9,
    lesson: 3,
    title: "Merging Pull Requests",
    concepts:
      "PR merge options; branch cleanup after PR; relationship between GitHub PR merge and Git history.",
  },
  workflows: {
    pos: "T10L1",
    tour: 10,
    lesson: 1,
    title: "Git Workflows",
    concepts:
      "Choosing collaboration workflows; central/shared branch approaches; tradeoffs.",
  },
  forkingWorkflow: {
    pos: "T10L2",
    tour: 10,
    lesson: 2,
    title: "Forking Workflow (with Branching)",
    concepts:
      "Fork-based collaboration with branches; upstream/origin roles in a fork workflow.",
  },
  otherPmFeatures: {
    pos: "T10L3",
    tour: 10,
    lesson: 3,
    title: "Other Project Management Features",
    concepts:
      "GitHub project-management features around issues, milestones, boards, and project coordination.",
  },
};

/** `lesson_name`s in course order. */
export const LESSON_ORDER: string[] = [
  "intro",
  "gitPrep",
  "init",
  "stage",
  "commit",
  "log",
  "remoteRepos",
  "githubPrep",
  "createRemoteRepo",
  "setRemote",
  "push",
  "ignore",
  "fork",
  "clone",
  "pull",
  "show",
  "tag",
  "diff",
  "checkout",
  "reset",
  "revert",
  "selectiveStage",
  "commitMessage",
  "interactiveRebase",
  "branch",
  "merge",
  "mergeConflicts",
  "branchRename",
  "branchDelete",
  "worktrees",
  "syncByMerge",
  "syncByRebase",
  "cherryPick",
  "remoteBranchPush",
  "remoteBranchPull",
  "remoteBranchDelete",
  "remoteBranchRename",
  "prsCreate",
  "prsReview",
  "prsMerge",
  "workflows",
  "forkingWorkflow",
  "otherPmFeatures",
];
