# pi-language-tutor

<p align="center">
  <strong>Learn a foreign language while you code.</strong><br />
  A <a href="https://pi.dev">pi</a> extension that reviews your prompts, teaches you how to say what you couldn’t yet, saves new words as flashcards, and turns agent replies into bilingual immersive translations.
</p>

<p align="center">
  <a href="https://github.com/SunsetWan/pi-language-tutor/releases"><img src="https://img.shields.io/github/v/release/SunsetWan/pi-language-tutor" alt="release" /></a>
  <a href="https://github.com/SunsetWan/pi-language-tutor/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SunsetWan/pi-language-tutor/ci.yml?branch=main&label=CI" alt="CI" /></a>
  <a href="https://github.com/SunsetWan/pi-language-tutor/blob/main/LICENSE"><img src="https://img.shields.io/github/license/SunsetWan/pi-language-tutor" alt="license" /></a>
  <a href="https://github.com/SunsetWan/pi-language-tutor"><img src="https://img.shields.io/github/stars/SunsetWan/pi-language-tutor" alt="stars" /></a>
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

## Install

Requires **[Pi 1.3.0](https://github.com/earendil-works/pi/releases/tag/v1.3.0)** and Node.js 22.19.0 or later. This fork supports only this Pi release; older Pi versions and OMP are unsupported.

```sh
pi install git:github.com/SunsetWan/pi-language-tutor@v0.1.0
```

That’s the only required step. Defaults (learning English, native Simplified Chinese) work out of the box. Another language? Type `/lang` or run `/lang native ja`.

The tag pins the installed version. Install a newer release tag when you want to upgrade.

If you already use the upstream extension, run `pi list` and remove its source with `pi remove <source>` before installing this fork. For example, use `pi remove npm:pi-language-tutor` for the upstream npm package. If you installed a symlink manually, remove that link. This prevents duplicate extensions. Existing settings and flashcards use the same files.

<details>
<summary>Development: track main or use a local clone</summary>

```sh
pi install git:github.com/SunsetWan/pi-language-tutor@main
```

Or symlink a clone into pi’s global extensions directory (auto-discovered via `pi.extensions`, hot-reloads with `/reload`):

```sh
git clone https://github.com/SunsetWan/pi-language-tutor.git
ln -s "$(pwd)/pi-language-tutor" ~/.pi/agent/extensions/pi-language-tutor
```

</details>

## Features

### ✏ Writing check

Prompt in the language you’re learning. While the agent works, a panel explains each mistake in your **native** language — fix, why, and a more natural whole sentence.

<img src="https://raw.githubusercontent.com/SunsetWan/pi-language-tutor/main/docs/writing-check.png" width="720" alt="Writing check panel explaining mistakes in the native language while the agent continues working" />

### ✏ Writing tutor

Prompt in your **native** language because the thought came faster that way. The tutor teaches the natural whole-sentence form in the learning language, the key words, and the grammar that carries it.

<img src="https://raw.githubusercontent.com/SunsetWan/pi-language-tutor/main/docs/writing-tutor.png" width="720" alt="Writing tutor panel: whole-sentence English, vocabulary notes, and grammar for a Chinese prompt" />

### 🗂 Flashcard review

Words taught by the Writing tutor are saved automatically. Run `/flashcards` to study them with an Anki-style flow; an FSRS scheduler decides when each card comes back.

### 🌐 Bilingual cards

After a reply, press `alt+t` (macOS: ⌥T) or run `/translate`. Each paragraph is followed by its translation — immersive-translate style, with short code blocks kept intact.

<img src="https://raw.githubusercontent.com/SunsetWan/pi-language-tutor/main/docs/bilingual-card.png" width="720" alt="Bilingual card: each English paragraph followed by its Chinese translation" />

## Try this first

1. Start `pi` and send a prompt in your learning language:

   ```text
   when agent anwser me, I want translate it, it have three feature
   ```

   The agent answers as usual. A `✏ Writing check` panel appears above the editor with fixes and native-language explanations.

2. Write a prompt in your **native** language instead:

   ```text
   我想重构这个函数但是不知道怎么下手
   ```

   A `✏ Writing tutor` panel appears: a natural whole-sentence rendering, key vocabulary, and grammar.

3. Words from the tutor are now flashcards. Run `/flashcards`, show the answer, then rate yourself Again / Hard / Good / Easy.

4. When the agent finishes, press `alt+t` (on macOS, [enable Option-as-Meta](https://iterm2.com/documentation-preferences-profiles-keys.html) in your terminal, or run `/translate`). The reply re-renders as a bilingual card.

5. Prefer auto-translate on every final response?

   ```text
   /lang auto on
   ```

That’s enough to start.

## Design principles

|                                       |                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Nothing ever blocks**               | Your message goes to the agent immediately; the review runs in parallel. A clean message shows no panel at all.  |
| **Two panels, never both**            | Learning language → Writing check. Native language → Writing tutor. One LLM call decides — they never both fire. |
| **Nothing pollutes the conversation** | Translation cards live only in your terminal — never sent back to the LLM, no context cost.                      |
| **You control the spend**             | Features use your session model by default; point them at a cheaper one with `/lang model`.                      |

## Settings

Type `/lang` for the interactive menu, or set options directly:

| Command                                | What it does                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/translate` or `alt+t`                | Translate the last assistant response                                                     |
| `/flashcards`                          | Review flashcards captured from the Writing tutor                                         |
| `/lang`                                | Interactive settings menu                                                                 |
| `/lang check off` \| `on` \| `context` | Writing check & tutor mode (`context` sees the conversation; `/lang on`/`off` still work) |
| `/lang tutor on` \| `off`              | Keep / drop the writing tutor alone                                                       |
| `/lang auto on` \| `off`               | Auto-translate every final response                                                       |
| `/lang native <code>`                  | Native language — translations & explanations (`zh-CN`, `ja`, …)                          |
| `/lang learning <code>`                | Language you’re practicing (`en`, `fr`, …)                                                |
| `/lang model [model]`                  | Model for this extension                                                                  |
| `/lang model default`                  | Follow the session model                                                                  |
| `/lang context on` \| `off`            | Translations with full session context (off by default)                                   |

## Configuration

Settings persist in `~/.pi/agent/language-learn.json`.

If `PI_CODING_AGENT_DIR` is set, settings and flashcards use that directory.

```json
{
  "learning": "en",
  "native": "zh-CN",
  "model": "openai/gpt-4o-mini",
  "check": "on",
  "tutor": true,
  "auto": false,
  "context": false
}
```

`model` defaults to the session model. `tutor` defaults to on.

Flashcards are stored in `~/.pi/agent/flashcards.json`. Review limits and FSRS desired retention are stored in `~/.pi/agent/flashcards-settings.json`.

## Advanced

Skip heuristics, check vs tutor rules, flashcard scheduling, bilingual card details, custom providers, and context-mode cost trade-offs:

→ **[Advanced behavior](https://github.com/SunsetWan/pi-language-tutor/blob/main/docs/advanced.md)**

## Maintenance

SunsetWan maintains this fork of [mackt/pi-language-tutor](https://github.com/mackt/pi-language-tutor). The MIT license and upstream copyright remain in place.

- `main` is the development and release branch. Changes enter through PRs after CI passes.
- Upstream changes are reviewed and selected as needed. There is no automatic upstream merge.
- Support moves to the latest Pi release after validation. The three Pi SDK dependencies are updated together.
- This fork starts its own version sequence at `v0.1.0`. Releases are published on [GitHub](https://github.com/SunsetWan/pi-language-tutor/releases) and installed from Git.

## Development

```sh
npm install
npm run check   # typecheck
npm test        # unit tests
npm run lint
npm run fmt:check
```

Layout, scripts, and how product screenshots are produced:

→ **[Development guide](https://github.com/SunsetWan/pi-language-tutor/blob/main/docs/development.md)**

Contributions welcome via PR. Conventions live in [AGENTS.md](https://github.com/SunsetWan/pi-language-tutor/blob/main/AGENTS.md).

## License

[MIT](LICENSE)
