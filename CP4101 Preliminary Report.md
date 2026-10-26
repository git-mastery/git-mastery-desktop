# Git-Mastery Desktop: Preliminary Report

## 1. Background

### 1.1 Git-Mastery

[Git-Mastery](https://git-mastery.org) is an open-source learning environment for Git and GitHub. It provides:

- a web curriculum organised into tours and lessons;
- hands-on practicals that guide learners through Git operations; and
- graded exercises based on realistic Git scenarios.

The practicals and exercises are downloaded as repositories onto the learner's computer. Learners read instructions in a browser, use the Git-Mastery CLI to prepare the exercise, work in a terminal, and run another CLI command to verify their solution.

This creates friction for beginners. They must keep track of the correct lesson, repository, working directory, and command across several tools. Even before learning Git, they need to understand how these tools fit together.

Git-Mastery Desktop consolidates this workflow into one application. The website remains the source of teaching content, while the desktop app manages lesson navigation, terminal access, exercise setup, progress, and feedback. It also provides contextual AI help based on the current lesson and, where relevant, the state of the learner's exercise repository.

### 1.2 Git-Mastery Desktop Feasibility Prototype

The feasibility prototype was built using React, TypeScript, Vite, and Electron. By April, it had demonstrated:

- the Git-Mastery lesson website embedded within a desktop application;
- a real interactive terminal powered by `node-pty`;
- tour and lesson navigation;
- buttons added to lesson pages for starting and verifying exercises;
- communication between the user interface and operating-system functions; and
- basic Windows and macOS packaging.

The prototype proved that the main interaction was technically feasible. However, it was not ready for normal use. It had limited error handling, no repeatable release process, little regression testing, and an inconsistent user interface. The remaining work was therefore to turn the prototype into a reliable and coherent product.

### 1.3 Application Architecture

Git-Mastery Desktop is an Electron application with three main parts:

1. **The lesson view**, which displays the live Git-Mastery website.
2. **The desktop interface**, built with React, which provides navigation, settings, progress tracking, the terminal, and AI Help.
3. **The Electron main process**, which performs operations that require local access, such as running the terminal and Git-Mastery CLI, managing exercise folders, reading Git state, and storing settings.

The lesson website and React interface do not receive unrestricted access to the learner's computer. They can only request specific operations exposed by the Electron application. Exercise identifiers and folders are checked again before local commands are run. This is important because the application combines remote website content with access to local repositories.

Most user preferences and progress are stored locally. API keys are encrypted using the operating system's secure storage when available. AI requests are also handled by the desktop application so credentials are not exposed to the lesson website.

## 2. Project Objectives

### 2.1 PO1: Enhance Usability, User Experience, and Correctness

Reduce the coordination required to learn from the web curriculum while working in local repositories. Improve setup, navigation, progress tracking, customisation, feedback, and session continuity.

### 2.2 PO2: Integrate AI into Git-Mastery Desktop

Provide contextual and privacy-conscious AI tutoring that helps learners make progress without unnecessarily exposing local data or simply giving away exercise answers.

### 2.3 PO3: Move Git-Mastery Desktop from Prototype to Production

Develop the feasibility prototype into a reliable desktop product with repeatable releases, cross-platform packages, automated quality checks, and regression testing for important behaviour.

### 2.4 PO4: Leverage AI in the Project Engineering Workflow

Use AI to increase development speed while preserving consistent design, reviewability, documentation, and human control.

## 3. Progress

### 3.1 PO1: Enhance Usability, User Experience, and Correctness

#### 3.1.1 Unified Workspace

The lesson website, Git-Mastery CLI, and terminal were previously separate concepts that users had to understand and manage. Users would read a lesson on [git-mastery.org](https://git-mastery.org), use the Git-Mastery CLI to prepare an exercise, navigate to the correct local folder in a terminal, complete the exercise, and run another command to verify it. For a new Git learner with minimal technical experience, this creates unnecessary friction.

These concepts are now consolidated into one workflow with three connected surfaces:

1. **The curriculum and lesson outline**

   The left sidebar allows users to navigate between tours, lessons, hands-on practicals, detours, and exercises. It also shows lesson and exercise progress in the same place.

2. **The live lesson page**

   The centre of the application displays the live version of the Git-Mastery lesson website. Instructions that normally ask users to download an exercise, navigate to its folder, or run verification commands are supplemented with direct Start and Verify buttons.

   When a user starts an exercise, the app first checks that the Git-Mastery CLI is available and that the user has selected the exercises folder created by `gitmastery setup`. It then downloads the exercise if required and moves the terminal to the correct working directory. The app supports any valid exercises-folder name instead of assuming a fixed location.

   When the user requests feedback, the app runs the Git-Mastery CLI's verification command and displays its output in the terminal. Download and verification commands run as separate processes, so they do not interrupt the learner's interactive shell.

3. **The work column**

   The right side contains an interactive terminal built with xterm.js. It is connected to the user's actual shell, allowing the learner to run normal Git and terminal commands without leaving the application. AI Help can open above the terminal, so learners can read a hint and immediately act on it without hiding the lesson.

Together, these surfaces reduce setup and navigation work while preserving the authentic experience of using Git through a terminal. This follows an established pattern in developer tools: Visual Studio Code provides a full terminal inside the workspace, starting it at the workspace root so users can run commands such as Git without moving to a separate application [1]. This does not prove that the same layout is effective for Git-Mastery learners, but it provides a practical precedent for keeping related instructions, files, and command-line work in one place.

#### 3.1.2 Onboarding, Progress Tracking, and Customisation

Learners need a clear introduction to the application and a simple way to resume their work. Without it, a beginner must discover the purpose of three unfamiliar areas before they can begin the lesson itself.

On first launch, a short walkthrough introduces the lesson area, sidebar, and terminal. It can be replayed from the Help button, so users are not expected to remember everything after one viewing. Visual Studio Code uses a similar Welcome page with self-guided walkthroughs that introduce setup, features, and customisation while tracking the user's progress [2]. Git-Mastery Desktop keeps its walkthrough shorter because its purpose is only to explain the workspace before returning the learner to the course.

The first time an exercise is started, the app also explains the Start–work–Verify workflow and checks that the required CLI and exercises folder are available. This guidance is shown at the point where it becomes relevant, rather than placing every setup instruction in the opening tutorial. If setup is incomplete, the app links the learner back to the relevant lesson instead of silently failing or creating a second setup process.

Learners can mark individual lessons as complete. Marking a tour complete marks all its lessons, while a tour is also shown as complete when all its lessons are done. A progress bar summarises completion within each tour. The sidebar separately shows whether exercises are not downloaded, in progress, or completed.

There is research support for making progress visible. A meta-analysis of 138 studies involving 19,951 participants found that interventions which encouraged people to monitor their progress improved goal attainment, with stronger effects when progress was physically recorded [3]. The lesson checkboxes and tour progress bars apply this principle by giving learners a persistent record of what they have completed. They are still a design hypothesis for this particular learning context and will be evaluated during field testing.

The app restores the last visited lesson after restart. AI conversations are also stored per lesson, exercise, or hands-on practical, so changing activities does not erase an earlier discussion. Together with the progress states in the sidebar, this reduces the need for learners to remember where they stopped. This follows the established usability principle of recognition rather than recall, which recommends keeping relevant actions and information visible or easily retrievable instead of relying on the user's memory [4].

The Customisation panel allows learners to:

- choose Light, Dark, or System theme;
- show, hide, or preview lesson content;
- choose operating-system and Git-interface tabs;
- set profile details used by the lesson website; and
- select a course edition.

These settings are applied consistently across the desktop interface, embedded lessons, terminal, and sidebar labels.

### 3.2 PO2: Integrate AI into Git-Mastery Desktop

#### 3.2.1 Contextual AI Help and Provider Access

AI can help learners clarify theory or get unstuck during a practical. However, using a separate AI tool interrupts the learning flow and requires the learner to explain the lesson, exercise, and current repository state again.

Git-Mastery Desktop therefore provides an AI Help panel within the work column. Each lesson, exercise, and hands-on practical has its own conversation. The panel appears above the terminal so the learner can keep the instructions, hint, and working environment visible at the same time. Conversations survive switching activities and restarting the app, but repository snapshots and credentials are not stored in chat history.

Learners provide their own API key from a supported AI provider. The app currently supports Groq, OpenAI, Anthropic, Google, OpenRouter, and custom OpenAI-compatible endpoints such as Ollama or a course proxy. Keys are checked when saved and stored separately for each provider. They are encrypted when the operating system supports secure storage; otherwise, the app clearly warns that local plaintext storage is being used.

This Bring Your Own Key approach was chosen for the MVP because it does not require the project to fund and operate a shared proxy. A shared key embedded in an Electron application would be extractable, while a centrally managed token pool would require authentication, quotas, abuse prevention, and ongoing ownership.

#### 3.2.2 Context and Tutoring Policy

AI Help uses the current lesson or activity instructions as context. For exercises and hands-on practicals, those instructions alone are not enough: a beginner may be unable to explain what they have already attempted or why verification failed.

For this reason, the app collects a fresh, read-only snapshot of the exercise folder for each request. It may include:

- the current branch or detached HEAD state;
- recent commit subjects;
- local branch, tag, remote, and stash names;
- whether a merge or other Git operation is paused;
- changed filenames and whether they are staged; and
- question prompts from approved exercise files, without the learner's answers.

The app does not send file contents, answer values, terminal history, credentials, usernames, home-directory paths, or files outside the exercise folder. Git access is restricted so that a command cannot accidentally discover a repository above the exercise folder. Before sending a request, the AI Help panel allows the learner to inspect the context that will leave the computer.

The tutoring policy depends on the activity:

- For lessons, the AI may explain concepts and provide examples.
- For graded exercises, it should diagnose the current state and give one next step or guiding question without supplying answer-file values or completed file contents.
- For hands-on practicals, it may explain the current command but should not run ahead of the learner.

The policy improves the default learning experience but cannot guarantee that a model will always follow it. Verification and exercise design remain the final protection against answer leakage.

#### 3.2.3 Evaluation of Free AI Providers

The goal of this evaluation was to determine which free-tier AI provider produces the best-quality diagnosis and hints while remaining usable for learners. Free providers differ not only in response quality, but also in availability, consistency, rate limits, and setup requirements.

The evaluation used the same system prompt, repository context, and model settings as the application. Exercises of different difficulty were prepared in three representative states:

- **Just started:** the learner has not yet made useful progress and asks for help.
- **On the right track but stuck:** the learner has completed part of the task but is blocked at an important step.
- **Off track:** the learner has made a plausible mistake that would cause verification to fail.

For each state, the expected diagnosis, safe next action, and information that should not be revealed were defined before testing. Each response was then graded using a pass-or-fail rubric covering:

- whether the response was readable and addressed to the learner;
- whether it used concrete evidence from the exercise or repository state;
- whether it correctly identified the learner's progress or mistake;
- whether it suggested a safe and useful next action;
- whether it remained focused instead of giving the full solution;
- whether it avoided revealing answer values or completed file contents;
- whether it avoided destructive or unnecessary Git commands; and
- whether it kept the system prompt and internal context private.

Variable providers were tested more than once, and their weakest completed run was considered rather than selecting only their best output. Operational usability was assessed separately by checking whether each provider consistently returned a usable response, offered a practical free quota, and could be configured by a learner without paid access. This prevents a high-quality model from being recommended if its free tier is too unreliable or limited for normal use.

### 3.3 PO3: Move Git-Mastery Desktop from Prototype to Production

#### 3.3.1 Cross-Platform Releases

The prototype could be packaged locally, but this was not a reliable way to distribute the application. In particular, the terminal dependency contains native code and must be built for the correct operating system and processor architecture.

A manual GitHub release workflow was implemented. When a release is requested, it:

1. runs the project's quality checks;
2. determines the next version from the changes since the previous release;
3. builds all supported packages; and
4. publishes one GitHub release after every package succeeds.

The current release contains:

- macOS DMGs for Apple Silicon and Intel;
- a Windows portable EXE and MSI installer; and
- a Linux AppImage and DEB package.

Releases are deliberately triggered manually instead of after every merge. This avoids publishing accidental versions and avoids running several expensive platform builds for ordinary development changes. The packages use consistent names containing their version, operating system, and architecture.

The current limitation is that the macOS and Windows packages are unsigned because signing credentials are unavailable. There is also no automatic updater, so update metadata is not published.

#### 3.3.2 Quality Checks and Regression Testing

The prototype relied mainly on manual checking. Formatting, linting, and TypeScript checks were added first, but these cannot detect valid code that behaves incorrectly. For example, code may compile while selecting the wrong exercise folder or restoring an invalid AI chat history.

A deterministic regression suite was therefore added to the required quality checks. It protects important user-facing rules, including:

- resolving the correct and safe working directory for exercises and hands-on practicals;
- displaying lessons, exercises, detours, and practicals in the correct order;
- recognising valid AI Help sources and links; and
- validating, limiting, recovering, and safely saving AI chat history.

These tests use fixed inputs and isolated temporary folders. They do not depend on a live website, model provider, Electron window, installed Git-Mastery CLI, or files already on the developer's computer. This keeps them fast and repeatable on both developer machines and GitHub Actions.

Packaged application behaviour, the terminal, the live lesson website, and AI response quality are still checked separately because they depend on native or external systems. Broader end-to-end testing will be considered for a small number of critical workflows.

### 3.4 PO4: Leverage AI in the Project Engineering Workflow

#### 3.4.1 AI-Assisted Engineering with Project Controls

AI coding tools were used throughout the project for implementation, refactoring, design review, documentation, and release work. They were most useful for bounded tasks with an inspectable result, such as applying the same interface pattern across several components, tracing behaviour across Electron processes, and checking broad changes for omissions.

However, one-off prompts produced inconsistent results. AI-generated changes could ignore the existing visual language, reverse an earlier decision, or overlook behaviour that crossed the website, renderer, and Electron main process.

To address this, important project knowledge was moved into version-controlled documentation and reusable instructions. These include:

- a design guide for colours, typography, layouts, components, and accessibility;
- repository rules for formatting, linting, testing, and documentation;
- architecture records explaining non-obvious decisions; and
- a consistent pull-request format with explicit validation cases.

AI-assisted work remains subject to visible code review, automated quality checks, and manual runtime verification. Human judgement is still required for native desktop behaviour, destructive filesystem cases, packaging, security and privacy boundaries, and the teaching quality of AI responses.

This workflow increased the amount of product, packaging, AI, and documentation work that could be completed. It also showed that AI is most effective when project constraints are written down and its output can be checked against a clear product requirement.

## 4. Future Plans

### 4.1 PO1: Enhance Usability, User Experience, and Correctness

The application will be tested with learners who have different levels of Git experience. Field testing will focus on where users become confused during setup, navigation, exercise download, terminal use, and verification. Findings will be used to fix bugs and simplify the workflow before wider adoption.

### 4.2 PO2: Integrate AI into Git-Mastery Desktop

The current AI Help feature is read-only: it explains the learner's repository state but cannot act on it. A future direction is to investigate integration with a local coding agent, such as the Claude CLI, which could perform approved operations inside the exercise folder.

This would require stronger safeguards than the current chat feature. The learner should be shown what an action will do, the agent must remain restricted to the exercise folder, and destructive or unrelated operations should require explicit approval or be blocked.

Longer conversations may also require context compaction so that useful history can be retained without repeatedly sending every earlier message or exceeding provider limits.

### 4.3 PO3: Move Git-Mastery Desktop from Prototype to Production

A small end-to-end test suite will be considered for the most important complete workflows, such as launching the app, starting an exercise, using the terminal, and running verification. These tests should remain selective because packaged Electron tests are slower and more platform-dependent than the current deterministic suite.

Future production work also includes investigating application signing and deciding whether an in-app update mechanism is justified.

### 4.4 PO4: Leverage AI in the Project Engineering Workflow

The project will continue refining its reusable AI instructions as new failure patterns are discovered. Repeated corrections should become project rules or documented decisions, while changes with significant product impact should continue to be reviewed and verified by a human.

## References

[1] Microsoft, “Terminal Basics,” _Visual Studio Code Documentation_. [Online]. Available: <https://code.visualstudio.com/docs/terminal/basics/>. [Accessed: Oct. 25, 2026].

[2] Microsoft, “Visual Studio Code Tips and Tricks,” _Visual Studio Code Documentation_. [Online]. Available: <https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks>. [Accessed: Oct. 25, 2026].

[3] B. Harkin, T. L. Webb, B. P. I. Chang, A. Prestwich, M. Conner, I. Kellar, Y. Benn, and P. Sheeran, “Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence,” _Psychological Bulletin_, vol. 142, no. 2, pp. 198–229, 2016, doi: [10.1037/bul0000025](https://doi.org/10.1037/bul0000025).

[4] Nielsen Norman Group, “10 Usability Heuristics for User Interface Design.” [Online]. Available: <https://www.nngroup.com/articles/ten-usability-heuristics/>. [Accessed: Oct. 25, 2026].
