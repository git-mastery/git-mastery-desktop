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

- **The model is not a setting, except for Custom.** Each named provider always uses its spec's
  default model, and any model saved earlier is ignored. Students can't judge which model tutors
  well. Custom has no sensible default, so it keeps a required Model field.
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

### OpenRouter model

The default provider has to work with a free key. Every request uses `openrouter/free`, OpenRouter's
router over all zero-cost models, and sends no fallback list.

**Why the router alone.** Free-tier membership changes without notice (see `../llm-integration.md`,
Option 9), so any named free model eventually disappears or is rate-limited, and a hard-coded list
needs upkeep with every change. The router always resolves to something that is currently free, so
the default keeps working with nothing to maintain.

**The cost is quality.** The router picks from every zero-cost model, and some can't tutor. In
testing it produced:

- a ~2B agent-tuned model (`liquid/lfm-2.5-2.6b`) answering in its raw tool-call syntax
  (`<|tool_call_start|>[read(filePath=…)]<|tool_call_end|>`), because it wanted to read files and no
  tools were offered;
- a content-safety classifier (`nvidia/nemotron-3.5-content-safety`) answering "User Safety: safe".

What limits the damage:

- The system prompt says the model has no tools and must reply only in text. Weaker agent-tuned
  models then answer in prose more often, but not reliably.
- **Regenerate** sends the request again, which usually lands on a different model.
- The classifier and code-only models can't be steered by the prompt. When they answer, the reply is
  obviously wrong rather than subtly misleading, which is the lesser failure for a tutor.
- Students who want consistent answers can switch to a paid provider, or to Google's free tier, in
  Settings.

**Alternatives rejected:**

- **Named free models first, with `openrouter/free` as the last fallback.** This was the previous
  setup (a primary model plus three fallbacks, the most OpenRouter accepts). It gave better replies
  while the named models stayed free, but they had to be checked and replaced by hand whenever they
  left the free tier or were throttled.
- **Stripping tool-call tokens from the output.** This treats one model family's symptom, and the
  answer underneath still comes from a model too small to tutor.
- **Choosing a free model at runtime from `/models`.** The listing has price and context length but
  no quality signal. It can't tell a 2B model or a classifier from a 30B instruct model.
- **A paid default model.** It would be reliable, but every student would need a funded account,
  which is what the free default exists to avoid.

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
