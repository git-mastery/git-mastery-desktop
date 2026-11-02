# Free AI tutor provider evaluation

This document is the final methodology, result, and recommendation for choosing a free
AI Hints provider for Git-Mastery Desktop. It replaces the earlier separate protocol and
results report.

## 1. Methodology

### Providers

The trial used the models students actually receive:

| Provider      | Model                 | Runs                                                  |
| ------------- | --------------------- | ----------------------------------------------------- |
| OpenRouter    | `openrouter/free`     | Three, because the router changes model between calls |
| Google Gemini | `gemini-3.8-flash`    | One                                                   |
| Groq          | `openai/gpt-oss-120b` | One                                                   |

Each scene was a new chat. Empty and rate-limited replies were retried once. The request
used the app's real system prompt and current context shape:

- lesson-card instructions;
- exercise question stems, with answer lines omitted;
- names-only folder listing;
- derived Git facts followed by the raw Git snapshot.

The model had no tools, file bodies, or terminal scrollback.

### Exercises and scenes

Three exercises cover increasing difficulty:

| Exercise            | Level  | Student's task                                                         |
| ------------------- | ------ | ---------------------------------------------------------------------- |
| `under-control`     | Easy   | Initialize `control-me`, not its parent                                |
| `log-and-order`     | Medium | Read Git history and answer three questions in the outer `answers.txt` |
| `conflict-mediator` | Hard   | Merge `josh` into `main` and resolve `script.py`                       |

Each exercise has three scenes:

1. **Just started:** the student has done nothing useful and says “i'm stuck”.
2. **Halfway:** the student is on the right task but blocked at its important teaching
   point.
3. **Off track:** the student made a plausible mistake that causes Verify to fail.

The concrete states were:

| Exercise            | Just started                                   | Halfway                                     | Off track                                           |
| ------------------- | ---------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `under-control`     | No repository                                  | `notes.txt` exists, but still no repository | `.git` was created in the parent folder             |
| `log-and-order`     | Clean `main`, blank outer answers file         | Detached HEAD at `Rewrite the comments`     | A second answers file was committed inside the repo |
| `conflict-mediator` | Clean `main`; `john` merged, `josh` not merged | Correct merge paused on `script.py`         | Merge was started backwards, from `josh`            |

### Revised objective rubric

Each check is worth one point and is marked pass or fail. There are no half-points. If
S1 fails, the entire scene scores zero; an empty response, classifier label, or tool-call
dump cannot earn points for facts it happens not to disclose.

#### Shared checks for every scene

| ID  | Pass condition                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | The response is readable, student-facing prose. It is not empty, mostly tool-call syntax, or a classifier label.                                                                                                                                                                                      |
| S2  | It uses at least one concrete fact from the exercise instructions or repository snapshot. A generic Git explanation fails.                                                                                                                                                                            |
| S3  | It does not quote or describe the system prompt, hint policy, or attached context blocks.                                                                                                                                                                                                             |
| S4  | It does not recommend `git reset --hard`, force-push, `git checkout --ours`, `git checkout --theirs`, or another command that discards work unnecessarily. Removing only the confirmed misplaced parent `.git` in `under-control` scene C is allowed as part of that scene's tightly scoped recovery. |

#### Easy: `under-control` — 24 points

Each scene has the four shared checks plus four checks below, for eight points per
scene.

**Scene A — just started**

| ID  | Pass condition                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------ |
| A1  | Correctly diagnoses that `control-me` is not a Git repository yet.                                     |
| A2  | Says the repository must be initialized in `control-me`; it need not add a warning about the parent.   |
| A3  | Names `git init` as the useful next action.                                                            |
| A4  | Does not tell the student to add or commit files, and does not claim the exercise is already complete. |

**Scene B — halfway**

| ID  | Pass condition                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------ |
| B1  | Correctly diagnoses that `control-me` is still not a Git repository.                                   |
| B2  | Keeps the diagnosis on the missing repository rather than treating `notes.txt` as the task or blocker. |
| B3  | Names initializing `control-me` with `git init` as the useful next action.                             |
| B4  | Does not say deleting `notes.txt`, adding it, or committing it is required for Verify.                 |

**Scene C — off track**

| ID  | Pass condition                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Says the repository was initialized in the parent `under-control` folder rather than in `control-me`.                                                                                            |
| C2  | Says the exercise requires a repository inside `control-me`.                                                                                                                                     |
| C3  | Gives a correct, tightly scoped recovery. A dependent sequence that removes the misplaced parent `.git`, enters `control-me`, and initializes it counts as one coherent intervention and passes. |
| C4  | Does not claim that adding or committing files will repair the repository location.                                                                                                              |

#### Medium: `log-and-order` — 28 points

Scenes A and C have the four shared checks plus five checks below. Scene B has the four
shared checks plus six checks.

**Scene A — just started**

| ID  | Pass condition                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Explains that the task is to answer the outer `log-and-order/answers.txt` by reading the `crime-spree` history.                                                                                                       |
| A2  | Points to a relevant history command such as `git log` or `git show`.                                                                                                                                                 |
| A3  | Gives a command or pager action that can expose the needed history. A focused `git show <sha>` is as valid as a full-log command.                                                                                     |
| A4  | Gives one focused next action rather than a complete procedure for all three questions.                                                                                                                               |
| A5  | Does not label the Q1 SHA, Q2 commit message, or Q3 SHA as an answer to copy into `answers.txt`. Merely showing a visible log fact is allowed only if the student is still asked to interpret it rather than copy it. |

**Scene B — halfway**

| ID  | Pass condition                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Recognizes that HEAD is detached at the commit whose subject is `Rewrite the comments`.                                                                                     |
| B2  | Either connects that state to the relevant question or advances a different unanswered question correctly. The reply does not have to follow one prescribed question order. |
| B3  | If it discusses the current hash, it leaves the student to read and interpret it rather than labeling it as a value to copy.                                                |
| B4  | Does not supply the original `main` Q1 SHA or the Q2 commit message as an answer.                                                                                           |
| B5  | Gives one useful next action. A focused `git show`, `git log`, or hash-reading command passes.                                                                              |
| B6  | Does not claim the exercise is finished or tell the student to commit while detached.                                                                                       |

**Scene C — off track**

| ID  | Pass condition                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Recognizes that the latest commit added an `answers.txt` inside `crime-spree`.                                                            |
| C2  | Says Verify reads the outer `log-and-order/answers.txt`, beside the repository.                                                           |
| C3  | Does not label any verifier answer, including the new commit SHA, as a value to copy into the outer file.                                 |
| C4  | Does not claim that committing the inner file completed the exercise or that Verify is wrong.                                             |
| C5  | Gives a next action that addresses the outer file. It must not prescribe reset or rebase merely to remove the harmless inner-file commit. |

#### Hard: `conflict-mediator` — 27 points

Scene A has the four shared checks plus four checks below. Scene B has the four shared
checks plus six checks. Scene C has the four shared checks plus five checks.

**Scene A — just started**

| ID  | Pass condition                                                                                   |
| --- | ------------------------------------------------------------------------------------------------ |
| A1  | Recognizes that the student is on `main`, `john` is already merged, and `josh` remains unmerged. |
| A2  | Identifies merging `josh` into `main` as the useful next action.                                 |
| A3  | Does not run ahead into conflict-resolution or finishing commands before the conflict exists.    |
| A4  | Does not claim the exercise is already complete.                                                 |

**Scene B — halfway**

| ID  | Pass condition                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Recognizes that a merge is paused and `script.py` is conflicted. Naming `josh` again is not required when the paused merge is otherwise diagnosed correctly.                                                        |
| B2  | Explains that the conflict markers separate the two versions and must not remain in the resolved file.                                                                                                              |
| B3  | Directs the student toward the target stated in the exercise instructions. Repeating `print('Hello Everyone and World!')` is allowed because it is already given; resolving the conflict is the learning objective. |
| B4  | Makes editing or inspecting `script.py` the current action rather than staging or committing before it is resolved.                                                                                                 |
| B5  | Does not invent unseen current file contents. It may repeat details supplied by the student or exercise instructions.                                                                                               |
| B6  | Does not tell the student to abort the correctly directed merge.                                                                                                                                                    |

**Scene C — off track**

| ID  | Pass condition                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Recognizes that the student is on `josh` and the paused merge is bringing `main` into `josh`.                                                             |
| C2  | Explains that the required direction is the reverse: be on `main` and merge `josh`.                                                                       |
| C3  | Makes aborting the backwards merge the current recovery action. It may describe later dependent steps, but must not pretend the current merge is correct. |
| C4  | Does not disclose anything beyond the target line already printed in the exercise instructions.                                                           |
| C5  | Does not advise completing the current conflict on `josh`, because that leaves Verify failing.                                                            |

This version deliberately does not require one exact teaching script. It accepts
equivalent focused commands, a correct short recovery sequence, progress on another
unanswered question, and targets already printed in the instructions. It remains strict
about unreadable replies, destructive commands, verifier answers labeled for copying,
the wrong answers file, and the wrong merge direction.

### Recommendation threshold

A provider is recommendable when:

- every scene returns readable prose;
- no scene gives a destructive command;
- its total is at least `60/79`;
- isolated misses have been reviewed for practical impact.

Answer leakage remains a serious pedagogical defect, but it is recorded and reviewed
rather than acting as an automatic provider-wide disqualification. OpenRouter's official
score is its worst of three runs.

## 2. Scores

The recorded replies were rescored against the revised rubric.

| Provider                | Run       | Easy /24 | Medium /28 | Hard /27 | Total /79 |
| ----------------------- | --------- | -------: | ---------: | -------: | --------: |
| OpenRouter              | 1         |       24 |         21 |       14 |        59 |
| OpenRouter              | 2         |       15 |          7 |       22 |        44 |
| OpenRouter              | 3         |       24 |         17 |       25 |        66 |
| **OpenRouter official** | worst run |       15 |          7 |       22 |    **44** |
| Gemini                  | 1         |        8 |          0 |        0 |     **8** |
| **Groq**                | 1         |   **24** |     **22** |   **22** |    **68** |

### Why OpenRouter is ruled out

`openrouter/free` returned different models across calls. The set included capable
instruct models, a content-safety classifier, and a small agent model that emitted raw
tool-call syntax. Its three totals ranged from 44 to 66. A student cannot choose the
good run, and the worst run had three unusable replies. It therefore fails the readable
prose requirement and is too inconsistent to recommend.

### Why Gemini is ruled out

Gemini completed one scene, then Google's free tier returned a 20-request-per-day quota
error for the remaining eight scenes, including the retry. The `8/79` score is an
availability result, not a meaningful tutoring-quality estimate. Twenty daily requests
cannot support a class, so Gemini is ruled out operationally.

## 3. Groq's known failure points

Groq answered all nine scenes in clear prose, gave no destructive command, and usually
used the requested diagnosis-then-next-step shape. Its limitations are below.

### 1. It revealed two visible SHAs in `log-and-order`

**What happened:** On the just-started scene, Groq said that `a1b2c3d` answered the HEAD
question and `c0ffee1` was the commit for `Rewrite the comments`.

**Is this acceptable?** **Acceptable with a pedagogical warning.** The values were
already visible in the attached log, and the reply did not damage the exercise or block
Verify. However, identifying them as answers does part of the student's reading work,
so the answer-withholding check still fails.

### 2. It worked on question 2 instead of the detached-HEAD clue

**What happened:** Halfway through `log-and-order`, Groq noticed the current commit but
sent the student searching for the message required by question 2 instead of explaining
that detached HEAD was already sitting on the answer to questions 1 and 3.

**Is this acceptable?** **Acceptable but suboptimal.** It gave one correct, useful action
toward the same exercise and did not alter the repository. It missed the best teaching
opportunity, but it did not send the student backwards.

### 3. It missed the duplicate answers file

**What happened:** In the off-track `log-and-order` scene, Verify failed because the
student committed an inner `answers.txt`; Groq treated the problem as another history
search and did not point to the outer file.

**Is this acceptable?** **Not acceptable as a diagnosis.** Following the hint would not
fix Verify. The advice is non-destructive and a later hint can recover, but this is a
real failure on one of nine scenes.

### 4. It repeated the conflict's target line

**What happened:** During the open conflict, Groq repeated
`print('Hello Everyone and World!')`.

**Is this acceptable?** **Acceptable.** The exercise instructions already state that
exact target. The student still has to understand and remove the conflict markers. This
is no longer scored as leaking a hidden solution.

### 5. It tried to finish the backwards merge

**What happened:** In the hard off-track scene, Groq saw that the student was on `josh`
but suggested resolving the current conflict there. Verify expects the result on `main`.

**Is this acceptable?** **Not acceptable.** It would leave the exercise in the wrong
state. The action was not destructive, but this is Groq's most important known failure.

### 6. It gave the full repair for the misplaced repository

**What happened:** Groq said to remove the parent `.git`, enter `control-me`, and run
`git init`.

**Is this acceptable?** **Acceptable.** The sequence is short, correct, and limited to
recovering one mistake. Rejecting it solely because it contains dependent commands made
the previous rubric measure terseness rather than tutoring quality.

## 4. Recommendation

**Recommend Groq with `openai/gpt-oss-120b`.**

Groq is the only tested option that combines:

- a readable answer in every scene;
- fast and consistent responses from one named model;
- no destructive Git advice;
- the highest score under the practical rubric (`68/79`);
- useful, repository-specific diagnosis in most scenes.

The recommendation is relative, not an assertion that Groq is flawless. It has two
material misses: the duplicate answers file and the backwards merge. It also gives away
visible answer values too readily. These should remain documented and should guide
future prompt improvements.

OpenRouter is too variable to recommend, and Gemini's free quota is too small for class
use. On the evidence available, Groq is the strongest recommended free provider.
