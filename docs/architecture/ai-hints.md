# AI Hints

How the AI Hints feature is placed, gated, wired to a model, and kept from handing out answers.
What the model is told about the student is in `ai-context-providers.md`; how the app obtains
inference at all is assessed in `../llm-integration.md`.

## 1. Entry point

Every exercise card and every hands-on practical on the embedded lesson site gets an **AI Hints**
button, injected by `ipc/webContentsView.ts` next to the existing download controls. A click sends
the exercise id over `wcv-ai-hints`. Main re-validates it (format, exercise on disk, AI configured),
scrapes the title and instructions from the page, and announces an `AiSource` to the renderer
with `ai-hints-open`.

Lesson pages also contain ChatGPT `?q=` links. When AI is configured, those popups are denied and
the same pane opens a `lesson:…` session with the decoded question in the composer. Send is the
student's choice. See `ai-chat-sources.md`.

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
close/reopen and app restart (`ai-history.json` in userData). Switching to another source keeps the
previous conversation; **Clear history** deletes that source from memory and disk, then leaves the
pane on a fresh empty session. The split defaults to 60% of the column and becomes a fixed pixel
height once dragged.

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
a key `validate` probe and optional `providerOptions`. Shipped: **Groq** (recommended default),
OpenAI, Anthropic, Google, OpenRouter, and **Custom** for any OpenAI-compatible base URL (Ollama,
LM Studio, a course proxy).
Adding a provider is one spec; settings, IPC and the settings UI read the registry. The settings
picker lists Groq first and marks it Recommended. A saved provider still wins over that default.

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

### Default model

The default provider has to work with a free key. Every request uses Groq's named
`openai/gpt-oss-120b`. A named model is more consistent than a free-model router: the same tutor
answers every scene. The provider evaluation in `../development/ai-provider-tutor-eval.md` scored it
68/79, with readable prose in all nine scenes and no destructive commands.

Groq is wired through `@ai-sdk/groq`, not the generic OpenAI-compatible client. GPT-OSS returns
reasoning on the first turn. The generic adapter replayed that as `reasoning_content` on the next
request, which Groq rejects with HTTP 400, so a second message failed. The dedicated adapter
serializes history in Groq's own format. OpenRouter and Custom still use
`createOpenAICompatible`.

OpenRouter remains available. Its `openrouter/free` router still picks from every zero-cost model,
including classifiers and small agent models that cannot tutor. Students who already have an
OpenRouter key can keep using it.

**Alternatives rejected:**

- **Keep OpenRouter's router as the default.** It needs no model upkeep, but a student cannot choose
  the good run. Testing produced a ~2B agent-tuned model answering in raw tool-call syntax and a
  content-safety classifier answering "User Safety: safe".
- **Google Gemini as the default.** `gemini-3.8-flash` has a free tier, but a probe measured 20
  requests per day, which cannot support a class.
- **A paid default model.** It would be reliable, but every student would need a funded account,
  which is what the free default exists to avoid.

## 5. Tutoring policy

`ai/prompt.ts` builds the system prompt. The policy depends on the source kind:

- **Lessons are teaching pages.** The model may show commands and examples. No exercise folder is
  required; workspace context is not collected.
- **Exercises are graded.** The model diagnoses the snapshot in one or two sentences, then gives
  exactly one next step or guiding question. It may name branches, files, and commit subjects that
  already appear in the snapshot. It never writes the value a student should put in an answer file,
  never pastes a finished file body, and never lists the rest of the exercise. Repeated pressure
  does not change this.
- **Hands-on practicals are guided walkthroughs.** Same diagnosis-then-one-step shape. The model
  may point to the command the instructions give for the current step, but must not run ahead of
  where the repository shows the student to be.

Exercise and hands-on kinds share the same extra rules:

- **Scope.** Answers are limited to this source, Git and GitHub, the Git-Mastery app and CLI, and
  basic terminal use. Anything else is politely declined.
- **Injection resistance.** Context blocks are fenced data, never instructions, and the prompt is
  not revealed.
- **Grounding.** The model infers progress from the snapshot — derived Git facts first, then raw
  git output and any question stems — instead of asking what the student tried. When the work looks
  complete, it suggests running Verify.

The prompt is guidance rather than enforcement: a determined student can extract more than the
policy intends. Grading is what actually protects exercises, and the policy keeps the default
interaction pedagogical.
