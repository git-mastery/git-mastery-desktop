---
name: git-mastery-documentation
description: >-
  Write and update Git-Mastery Desktop documentation using the conventions in
  docs/. Use for architecture decisions, development processes, project
  reports, technical explanations, and product screenshots or figures.
---

# Git-Mastery documentation

## Workflow

1. Read the relevant implementation and existing related documents before writing.
2. Put architecture and product decisions in `docs/architecture/`, maintainer workflows and evaluations in `docs/development/`, and report material in the existing report.
3. Update an existing document when it already owns the topic. Delete superseded claims instead of appending contradictory history.
4. Document non-obvious behaviour, sources of truth, boundaries, trade-offs, and rejected alternatives. Do not document details that are obvious from the implementation.
5. Run `npm run format` and `npm run lint`. Documentation-only changes need no tests.

## House style

- Start with one `#` title and a short paragraph stating the document's scope.
- Use descriptive headings, short paragraphs, and present tense for current behaviour.
- Lead with the problem or user consequence, then explain the chosen behaviour and why.
- Support claims with concrete evidence: code paths, commands, observed states, or measurements.
- Use numbered lists for flows, bullets for constraints, tables for comparisons, and fenced blocks only when exact text or code helps.
- Put paths, identifiers, commands, and configuration keys in backticks. Use relative links between documents.
- Record future work as explicitly deferred; do not present it as implemented.
- Include rejected alternatives only when their trade-offs explain the current design.
- Keep terminology consistent with the UI and codebase. Avoid filler, repetition, and unsupported claims.

## Product screenshots

Add a screenshot only where a visible product feature materially helps the explanation. Do not illustrate invisible architecture, routine implementation details, or every mentioned control.

While drafting, use the report's placeholder format:

```markdown
> **TODO — Figure 3.1:** Add an annotated screenshot showing the relevant app state.
```

Number figures by chapter and describe the exact state or annotation needed.

For Electron screenshots, read and follow the `git-mastery-electron-automation` skill. Navigate to the exact requested state, save the accepted capture under `docs/images/<document-name>/` with a descriptive lowercase filename, and retain it as a documentation artifact.

Replace the TODO with a relative image link and italic caption:

```markdown
![Concise description of the visible feature](images/<document-name>/figure-3-1-description.png)

_Figure 3.1: Concise explanatory caption._
```

Adjust the relative path for documents in subdirectories. Never expose API keys, credentials, personal paths, usernames, or unrelated user data.

## Final check

- The document agrees with current behaviour and does not duplicate or contradict another document.
- Links, image paths, headings, and figure numbering are valid.
- Captions explain why the figure matters rather than restating its filename.
