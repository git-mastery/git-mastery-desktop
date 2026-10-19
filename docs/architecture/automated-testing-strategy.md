# Automated testing strategy

**Status:** Adopted

Git-Mastery Desktop uses a small, deterministic behavioural test suite as part
of its required quality gate. The first suite concentrates on logic whose
result is completely controlled by its inputs. It does not open Electron,
contact a website or AI provider, install the Git-Mastery CLI, or depend on the
state of the developer's computer.

This document records what the suite is intended to prove, why these boundaries
were chosen, and when broader testing should be added. It deliberately avoids
test framework configuration and individual test-case implementation.

## Context

The existing CI gate checks formatting, lint rules, and TypeScript compilation.
Those checks catch malformed or inconsistent code, but they cannot establish
that valid code still behaves correctly. A path resolver can compile while
choosing the wrong folder, a catalog join can silently omit an exercise, and a
history reader can accept data it should reject.

Packaged desktop end-to-end tests could detect some of these failures, but they
would introduce several unrelated sources of cost and instability:

- an Electron window and controlled operating-system environment;
- native dependency builds and a stable shell;
- fixture copies of the Git-Mastery CLI and lesson website;
- provider doubles for AI requests; and
- coordination across renderer, IPC, main process, and packaged application.

That cost is not justified while important deterministic rules have no direct
coverage. The first step is therefore a fast suite below the Electron boundary.

## Goals

The initial suite should:

- catch regressions in user-significant rules that have a single correct result;
- run the same way on a laptop and in CI;
- complete quickly enough to remain in the normal pull-request quality job;
- produce failures that identify the broken contract;
- exercise real filesystem semantics when those semantics are the subject of
  the test; and
- remain easy to extend when a defect reveals a missing case.

The suite is not intended to prove that Electron packages successfully, that a
live provider returns a useful answer, or that the Git-Mastery website and CLI
remain compatible. Those require different test layers and failure handling.

## First test sets, in simple terms

### Exercise paths and manifests

These tests check how the app decides which downloaded folder the learner
should work in.

They are meant to catch:

- unsafe folder names escaping the exercise directory;
- missing or malformed download metadata being treated as valid;
- interrupted downloads being mistaken for complete exercises;
- files being mistaken for directories;
- exercises that intentionally work at their root being sent into a subfolder;
  and
- hands-on practicals choosing the wrong working directory.

This logic uses temporary folders created by the test. That is more meaningful
than replacing filesystem calls with mocks because directory shape is part of
the contract. The folders contain no user data and are removed after each test.

### AI source and URL parsing

These tests check that lesson, exercise, and hands-on identities are built and
accepted consistently, and that supported links are recognised narrowly.

They are meant to catch:

- a source key claiming to represent a different kind or identifier;
- unsafe identifiers crossing the IPC or persistence boundary;
- hands-on practicals being classified as normal exercises;
- ordinary site pages being mistaken for lesson pages;
- trail or malformed links opening the wrong chat source; and
- unrelated or insecure URLs being accepted as supported ChatGPT prompt links.

Only parsing and classification are tested. No page is loaded and no prompt is
sent to an AI provider.

### Lesson catalog joins

These tests check how separate lesson, exercise, detour, and hands-on catalogs
are combined into the ordered outline shown by the app.

They are meant to catch:

- content from another lesson leaking into the current lesson;
- work-in-progress exercises becoming visible;
- detour exercises appearing at the top level or under the wrong detour;
- missing detours causing unrelated content to be joined accidentally;
- catalog order being lost; and
- hands-on items receiving an invalid panel identity.

The inputs are small in-memory catalog objects. The expected result is
structured data rather than rendered UI, so no browser or DOM is needed.

### Renderer history conversion

These tests check the safe projection from the live chat representation to the
small transcript stored on disk, and back again.

They are meant to catch:

- non-conversation message roles being persisted;
- non-text runtime data leaking into local history;
- empty conversations being written;
- oversized messages bypassing their retention limit;
- old turns not being removed when a source history becomes too large; and
- stored text being restored with the wrong role or order.

This set verifies deterministic data transformation only. It does not render
the chat panel or invoke a model.

### Main-process history validation and persistence

These tests check the public history load and save behaviour against an isolated
temporary storage directory.

They are meant to catch:

- malformed files or sessions entering the renderer;
- a stored session being filed under a source key that does not match it;
- corrupt files being overwritten instead of moved aside;
- a history created by a newer app version being destroyed by an older one;
- invalid or empty sessions being written;
- retention limits being skipped at the persistence boundary; and
- a successful save leaving partial data instead of a complete replacement.

Electron itself is not started. The operating-system storage-location lookup is
replaced at the boundary, while real file reads, writes, renames, and temporary
directories are retained.

## Test-layer decisions

### Pure unit tests are the default

Parsing, classification, catalog joins, and data conversion are tested as pure
input-to-output contracts. These tests have no clock, randomness, network,
process, or machine-state dependency.

Pure tests are preferred when they can cover the behaviour faithfully. They are
cheap to run, failures are local, and test data can describe edge conditions
more clearly than a full user journey.

### Filesystem tests use isolated real files

When behaviour depends on whether a path exists, is a directory, or can be
atomically replaced, real temporary files provide stronger evidence than a
mocked filesystem. Each test owns its directory and must not read from or write
to the application's real user-data or exercise locations.

These are lightweight integration tests, but they remain deterministic because
the test creates the complete environment it observes.

### Process boundaries may be replaced

Boundary doubles are permitted for facilities that cannot be loaded cheaply in
the test process, such as Electron's user-data lookup. A double should replace
the narrow boundary, not the behaviour under test. For example, redirecting a
storage directory is acceptable; replacing all history file operations is not.

### Prompt prose is outside the first suite

The system prompt is generated deterministically, but assertions over particular
sentences would couple the suite to prose edits. Whole-prompt snapshots would be
even noisier. Prompt quality and policy are better evaluated through the
existing tutor evaluation process until the policy is represented by a more
structured contract worth testing directly.

This is a maintainability decision, not a claim that model behaviour is
unimportant.

## Determinism rules

Tests in the required suite must not depend on:

- live network access, websites, or model providers;
- an installed Git-Mastery CLI or a particular shell;
- an Electron window or packaged application;
- the developer's configuration, home directory, repositories, or credentials;
- execution order or state left by another test;
- the current date, uncontrolled timers, or random values; or
- platform-specific path assumptions unless the test explicitly supplies and
  restores that platform boundary.

Fixed test inputs must produce the same result on every run. Temporary resources
must be independently created and cleaned up. If a test needs broad mocks,
retries, or timing tolerances, it probably belongs in a different layer.

## Assertion and maintenance policy

Tests should assert observable contracts rather than private helper structure.
A refactor that preserves behaviour should not require widespread test changes.

Assertions should be narrow enough that a failure explains the violated rule.
Large snapshots are avoided because they obscure which behaviour matters and
encourage unreviewed snapshot updates. Structured values should be compared as
structured values.

When fixing a deterministic defect, add a regression case to the lowest layer
that can reproduce it. New tests should not be added merely to increase a
coverage percentage; they should protect a stated risk or contract.

Production-only escape hatches should not be introduced solely for tests.
Where code is difficult to isolate, prefer clarifying a real architectural
boundary over exporting private implementation details.

## CI policy

Behavioural tests are a required part of the same pull-request and `main`
quality gate described in [the release pipeline](../development/release-pipeline.md).
A failing test blocks the gate in the same way as lint, formatting, or
type-check failures.

The deterministic suite should remain quick enough for the existing quality
job. A test that needs native packaging, external services, or a specialised
runner should not silently expand this gate; it should be proposed as a
separate layer with an explicit cost and ownership decision.

No coverage threshold is imposed initially. A numerical threshold would reward
executing low-risk lines without showing that important contracts are
protected. Coverage reports may later be used as diagnostic information, but a
gate should be introduced only when the team has enough stable tests to choose
a meaningful policy.

## Expansion triggers

Additional layers should be added in response to demonstrated risk:

- Add DOM or component tests when renderer interaction state repeatedly breaks
  and cannot be covered through pure view-model logic.
- Add CLI or subprocess contract tests when a stable executable fixture and
  controlled shell can represent supported platforms.
- Add provider adapter tests when transport-level fakes can verify request and
  error handling without live credentials or provider availability.
- Add a small packaged Electron end-to-end suite for critical journeys whose
  failures genuinely cross renderer, IPC, and main-process boundaries.
- Add a stable local substitute for site integration before testing embedded
  navigation or scraping behaviour.

Packaged end-to-end coverage should remain selective. Its role is to prove that
major boundaries are wired together, not to repeat every parser and edge case
already covered below those boundaries.

## Rejected alternatives

### Start with packaged end-to-end testing

This provides broad realism but poor fault isolation and a high setup burden.
It would delay coverage of deterministic rules and make ordinary CI dependent
on native and environmental concerns.

### Call live websites or AI providers

Availability, credentials, model revisions, rate limits, and output variation
would make failures difficult to reproduce. Such checks are evaluations or
operational probes, not deterministic regression tests.

### Mock every dependency

Deep mocking can make tests pass while production boundaries disagree. Pure
functions need no mocks, and filesystem contracts are better exercised with
isolated real files.

### Set a coverage target immediately

There is no existing behavioural baseline from which to choose a meaningful
percentage. The first priority is protecting high-impact decisions, not
maximising executed lines.

### Snapshot generated prompts

Prompt snapshots turn harmless copy changes into broad diffs and can be updated
without noticing a changed policy. The tutor evaluation suite is the current
home for prompt and model-behaviour assessment.

### Place tests inside production source trees

Keeping test files outside renderer and Electron source trees prevents
production TypeScript builds from treating them as application modules. It
also makes the boundary between shipped code and verification code explicit.

## Consequences

The repository gains a behavioural regression gate at low runtime and
maintenance cost. It will catch important deterministic failures, but it will
not certify packaging, native modules, cross-process UI journeys, live site
compatibility, or model answer quality.

That limitation is intentional. The suite should grow by adding the cheapest
layer that can reproduce a real risk, while preserving the speed and
repeatability of the default gate.

Revisit this strategy when a new test layer enters CI, when the deterministic
suite becomes materially slower, or when architectural changes move important
behaviour across the Electron boundary.
