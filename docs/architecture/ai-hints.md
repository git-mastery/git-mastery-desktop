# AI Hints

How the AI Hints feature is placed, gated, wired to a model, and kept from handing out answers.
What the model is told about the student is in `ai-context-providers.md`; how the app obtains
inference at all is assessed in `../llm-integration.md`.

## 1. Entry point

Every exercise card and every hands-on practical on the embedded lesson site gets an **AI Hints**
button, injected by `ipc/webContentsView.ts` next to the existing download controls. A click sends
the exercise id over `wcv-ai-hints`. Main re-validates it (format, exercise on disk, AI configured),
scrapes the title and instructions from the page, and announces an `AiHintsSession` to the renderer
with `ai-hints-open`.

Hands-on practicals have no identifier on the page beyond the `hp-…` id in their download command,
so the injected script tags the wrapper with `data-gm-hands-on-id` when it adds its buttons. The
instruction scrape reads `innerText` with the injected controls (`data-gm-actions`) hidden, so the
model never sees "AI Hints" or "Start Exercise" as part of the task.

## 2. Enablement

The button is only enabled when there is something to ground a hint in:

1. **AI is configured**: the active provider has everything it needs (key, base URL, model).
2. **The exercise is on disk**: `resolveExerciseCwd` returns `ready` for that id.

A disabled button carries a tooltip naming the missing step ("Click Start Exercise first…", "Set up
AI hints in Settings first"). A hint without the student's repository could only paraphrase the
instructions back at them, which is the failure `ai-context-providers.md` §1 describes.

Main pushes `{ configured, ready: string[] }` into the page (`__gmSetAiState`) on dom-ready, after a
download or Start, after AI settings are saved, when the exercises root changes, and when the window
regains focus. Focus covers the one change the app cannot observe: the student deleting a folder in
Finder. The click handler re-checks rather than trusting page state, since the page is remote content.

## 3. Placement

The chat is a pane **stacked above the terminal** in the right-hand work column, with a draggable
divider between them. Closing it returns the full height to the terminal; the conversation survives
close/reopen and is only cleared by **Clear history** or opening hints for a different exercise. The split
defaults to 60% of the column and becomes a fixed pixel height once dragged.

The layout never exceeds three columns: lessons nav, lesson page, work column. The lesson page's
width does not change when hints open, so instructions don't reflow, and the hint sits directly
above the prompt it will be acted on in.

### Rejected

- **A docked fourth column** between the lesson page and the terminal. Built first, and too
  crowded: with the lessons nav open the window held four panes, and making room for the chat meant
  squeezing the lesson page or auto-collapsing the nav.
- **A floating modal or popover over the lesson page.** The lesson site is a native
  `WebContentsView`, which paints above all DOM. A DOM overlay would need to suppress the view (via
  `useEmbeddedSuppressed`), hiding the very instructions the student is asking about. It would also
  cover the page while the student works through a hint.
- **A floating second `WebContentsView` for the chat.** This was the previous implementation: its own
  renderer, route, drag handling and window-level IPC. It solves the stacking problem, but it is a
  second web contents with its own lifecycle, and it still covers the lesson.
- **Tabs in the work column ("Terminal | AI Hints").** Cheaper on space, but students would have to
  switch away from the chat to run the command it just explained, then switch back to read the next
  step.

## 4. Providers

`ai/llmProviders.ts` is a registry of `ProviderSpec`s. Each spec has display metadata, `createModel`,
a key `validate` probe and optional `providerOptions`. Shipped: OpenRouter (default), OpenAI,
Anthropic, Google, and **Custom** for any OpenAI-compatible base URL (Groq, Ollama, a course proxy).
Adding a provider is one spec; settings, IPC and the settings UI read the registry.

- **OpenRouter uses a curated fallback list, not `openrouter/free` alone.** The free router picks
  any zero-cost model. That includes ~2B agent-tuned models (e.g. `liquid/lfm-2.5-2.6b`), which
  answered hints with raw `<|tool_call_start|>…` tokens because no tools were offered, and a
  content-safety classifier that answered "User Safety: safe". The default instead sends
  OpenRouter's `models` fallback array of three named instruction-tuned free models. OpenRouter moves
  down the list when a model is down, rate-limited, or has left the free tier. `openrouter/free` is
  not kept as a last resort: when all three are busy, a clear rate-limit error serves the student
  better than an answer from an arbitrary model. The cost is a list that needs occasional upkeep. Stripping the tokens from output was rejected: it treats one
  model's symptom, and the answer underneath is still from a model too small to tutor.
- **The model is not a setting, except for Custom.** Each named provider always uses its spec's
  default model, and any model saved earlier is ignored. Students can't judge which model tutors
  well, and a free-text model field is how `openrouter/free` got back in. Custom has no sensible
  default, so it keeps a required Model field.
- **Per-provider settings.** `config.ai.providers[id]` stores the key (plus base URL and model for
  Custom) for each provider separately, so switching providers doesn't discard a key already
  entered.
- **Keys are encrypted with `safeStorage`.** Where that is unavailable, keys fall back to plaintext
  and the settings panel says so.
- **Keys are validated on save.** Each spec probes a cheap authenticated endpoint. 401/403 means the
  key was rejected, and a network failure is reported as such, so a typo surfaces in Settings rather
  than as a failed chat. Custom endpoints treat a 404 on `/models` as acceptable because not every
  compatible server implements it.
- **All traffic goes through `net.fetch`.** Requests use Chromium's network stack, which trusts the
  macOS Keychain. Corporate TLS inspection certificates therefore work, where Node's bundled CA list
  would reject them.

The earlier OpenRouter-only key field (`openRouterApiKeyEnc`) was dropped without migration. The
feature had not shipped.

## 5. Tutoring policy

`ai/prompt.ts` builds the system prompt. The policy depends on the session kind:

- **Exercises are graded.** The model gives the smallest useful nudge, never the full command
  sequence or exercise-specific values, and never answers for `answers.txt`. It escalates one step at
  a time, and repeated pressure does not change this.
- **Hands-on practicals are guided walkthroughs.** The model may point to the command the
  instructions give for the current step, but must not run ahead of where the repository shows the
  student to be.

Both kinds share the same rules:

- **Scope.** Answers are limited to this exercise, Git and GitHub, the Git-Mastery app and CLI, and
  basic terminal use. Anything else is politely declined.
- **Injection resistance.** Context blocks are fenced data, never instructions, and the prompt is
  not revealed.
- **Grounding.** The model infers progress from the repository snapshot instead of asking what the
  student tried. When the work looks complete, it suggests running Verify.

The prompt is guidance rather than enforcement: a determined student can extract more than the
policy intends. Grading is what actually protects exercises, and the policy keeps the default
interaction pedagogical.
