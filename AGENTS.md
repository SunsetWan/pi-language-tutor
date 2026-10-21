# AGENTS.md

Working conventions for this repo. The code layout is documented in the
Development section of README.md — read that first.

## Verify before pushing

`npm run check` (typecheck), `npm test`, `npm run lint`, and
`npm run fmt:check` must all pass. Run `npm run fmt` to apply formatting
before the final check. When a change claims an improvement, put the measured
evidence in the commit/PR body (e.g. `npm pack --dry-run` sizes, test counts) —
not adjectives.

## Branches, commits, PRs

- Never commit directly to `main`; every change lands via a PR.
- Branch names: `<type>/<short-slug>` (`feat/context-mode`, `chore/slim-npm-package`).
- Commits follow Conventional Commits: `type(scope): subject` with types
  `feat` / `fix` / `chore` / `ci` / `docs` / `refactor`. Scope is the feature
  module or area (`lang`, `translate`, `settings`, `pkg`). Subject is
  imperative, ≤72 chars; the body explains what and why.
- PR title = the eventual squash-commit title (same format). PR body: what
  changed and why, then how it was verified. Link issues with `Closes #N`.

## Fork maintenance

- `SunsetWan/pi-language-tutor` owns the maintained `main` branch and releases.
  Use `origin` for this fork and `upstream` for `mackt/pi-language-tutor`.
  Verify remote URLs before pushing. Do not push to `upstream`.
- Review and select upstream changes as needed. Do not merge upstream
  automatically. Keep the upstream license and copyright notice.
- Support only the latest validated Pi release. Update the three Pi SDK
  packages together and run the full checks before merging.
- Fetch upstream branches without importing its release tags. If a historical
  tag is needed locally, store it under `upstream/` to avoid name conflicts.

## READMEs are bilingual twins

- `README.md` (EN) and `README.zh-CN.md` (zh) mirror each other
  section-for-section. Any edit to one must be synced to the other in the
  same PR. The zh version is written as natural Chinese, not a mechanical
  translation of the EN sentences.
- Images use absolute GitHub raw URLs for this fork.

## Releases

Publish GitHub Releases and install from Git. The package is marked `private`
to prevent npm publication. The fork has its own version sequence, starting
at `0.1.0`.

1. From the latest `main`, create a branch named `chore/bump-version-X.Y.Z`.
2. Run `npm version X.Y.Z --no-git-tag-version`. Commit only `package.json` and
   `package-lock.json` as `chore(pkg): bump version to X.Y.Z`, then open and
   merge the version-bump PR after all checks pass.
3. Update local `main` to the merged commit and confirm its CI passes. Verify
   that the new tag does not already exist on `origin`, then create its annotated
   tag: `git tag -a vX.Y.Z -m "chore(release): X.Y.Z"` followed by
   `git push origin vX.Y.Z`.
4. Wait for tag CI to pass. It checks that the tag matches both manifests.
   Create the GitHub Release, then include the supported Pi version and the
   pinned Git install command in its notes:

   ```sh
   gh release create vX.Y.Z --repo SunsetWan/pi-language-tutor \
     --verify-tag --generate-notes
   ```

5. Verify the remote tag, GitHub Release, and a Git installation with a
   temporary `PI_CODING_AGENT_DIR`.

Do not run `npm version` again after the bump PR is merged; the merged manifest
already contains the release version, and another minor/patch bump would advance
it to the next version.

The package contents are whitelisted by `files` in package.json; if you add
runtime files outside `src/`, update it and sanity-check `npm pack --dry-run`.

## Design ground rules

- `src/core.ts` stays pure: zero pi imports, no I/O — it is the unit-test
  surface (`test/core.test.ts`, run by vitest). New logic goes
  there when it doesn't need pi APIs.
- Feature modules (`llm.ts`, `grammar.ts`, `translate.ts`, `settings.ts`,
  `flashcards.ts`, `learn.ts`) keep one-way dependencies and expose minimal
  interfaces; `index.ts` stays a thin composition root.
- Match pi ecosystem conventions before inventing UX: check the built-in
  commands and `examples/extensions/` in the matching Pi release for the
  established pattern.
