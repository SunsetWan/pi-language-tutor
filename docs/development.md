# Development

Working on [pi-language-tutor](../README.md) from a local clone.

Use Node.js 22.19.0 or later and Pi 1.4.0. The three Pi SDK packages are pinned to 1.4.0 in both development and peer dependencies. Update them together when adopting a new Pi release.

## Setup

```sh
git clone https://github.com/SunsetWan/pi-language-tutor.git
cd pi-language-tutor
npm ci
ln -s "$(pwd)" ~/.pi/agent/extensions/pi-language-tutor
```

There is no build step: pi loads TypeScript directly via the `pi.extensions` field in `package.json`. After edits, run `/reload` in the TUI.

## Scripts

```sh
npm run check      # typecheck (tsc --noEmit)
npm test           # unit and offline Pi SDK integration tests
npm run lint       # oxlint
npm run fmt        # oxfmt
npm run fmt:check  # format check (CI)
```

`npm run check`, `npm test`, `npm run lint`, and `npm run fmt:check` must all pass before opening a PR (see [AGENTS.md](../AGENTS.md)).

Tests cover core behavior, FSRS scheduling, Pi provider dispatch, full-transcript replay, renderers, lifecycle events, and persistence. SDK tests use Pi's `fauxProvider` with in-memory credentials. They require no API keys or paid model calls. Persistence tests use a temporary `PI_CODING_AGENT_DIR`.

## Layout

| Path                        | Role                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/core.ts`               | Pure logic: heuristics, prompts, parsing, card assembly. **Zero pi imports** — the unit-test surface |
| `src/config.ts`             | Config load/save (`~/.pi/agent/language-learn.json`)                                                 |
| `src/llm.ts`                | Model resolution, LLM calls, session-fork tracking                                                   |
| `src/grammar.ts`            | Unified review: writing check + writing tutor dispatch                                               |
| `src/tutor.ts`              | Writing tutor renderer                                                                               |
| `src/translate.ts`          | Bilingual cards                                                                                      |
| `src/flashcards.ts`         | Flashcard persistence and FSRS scheduling                                                            |
| `src/flashcard-settings.ts` | Flashcard review settings                                                                            |
| `src/learn.ts`              | `/flashcards` review-window controller                                                               |
| `src/settings.ts`           | `/lang` command and interactive menu                                                                 |
| `src/index.ts`              | Composition root                                                                                     |
| `web/flashcards.html`       | Self-contained flashcard review UI                                                                   |
| `types/glimpseui.d.ts`      | Local type declarations for the review-window dependency                                             |
| `language-learn.ts`         | Package entry: re-exports core + default extension export                                            |

Feature modules keep one-way dependencies; new logic that does not need pi APIs goes in `core.ts`.

Use `modelRegistry.streamSimple()` for side calls, `context_with_system` to capture the full request transcript, `registerEntryRenderer()` for translation cards, `agent_settled` for automatic translation, and `model_select` for model warnings. Older Pi and OMP adapters have been removed.

## Manual acceptance

Install the clone with `pi install /path/to/clone` under a temporary `PI_CODING_AGENT_DIR`. Use Pi 1.4.0 and an offline `fauxProvider` with scripted review and translation responses. Keep test settings and cards in that directory.

1. Open `/lang`, submit an English prompt with a spelling error, and check the Writing check panel.
2. Submit a native-language prompt. Check the Writing tutor panel and the saved vocabulary.
3. Run `/translate`, then enable `/lang auto on`. Check paragraph pairs and intact short code blocks.
4. Enable both context modes. Check that side calls contain system messages, tool declarations, and the session ID. Run `/reload` and check saved settings and translation cards.
5. Open `/flashcards`, show the answer, rate Again, then Good. Check that Again repeats the card and Good stores its next review date.

This acceptance flow checks runtime integration and UI behavior. Scripted responses do not measure live model quality or provider cache billing.

## Product screenshots

| Asset                     | Notes                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/writing-check.png`  | Real terminal capture                                                                             |
| `docs/bilingual-card.png` | Real terminal capture                                                                             |
| `docs/writing-tutor.png`  | Real terminal capture (HTML mock in `docs/_shots/writing-tutor.html` kept as a fallback template) |
| `docs/demo.gif`           | Slideshow of the three panels for the README hero                                                 |
| `docs/logo.png`           | 256×256 logo for README header                                                                    |
| `docs/icon.png`           | Full app icon source                                                                              |

Regenerate the tutor mock:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1642,1169 \
  --screenshot="$(pwd)/docs/writing-tutor.png" \
  "file://$(pwd)/docs/_shots/writing-tutor.html"
```

To replace the hero with a live terminal recording, see [recording-demo.md](./recording-demo.md).

## Related

- [Advanced behavior](./advanced.md)
- [AGENTS.md](../AGENTS.md) — branch, commit, and release conventions
