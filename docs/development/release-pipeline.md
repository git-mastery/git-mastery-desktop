# Release pipeline

Releases are cut by hand. Merging to `main` never publishes; someone runs the **Release** workflow from the Actions tab.

## Versioning

Versions follow strict semver, derived from conventional commit titles on `main`:

| Commit                                       | Bump from `0.0.1` |
| -------------------------------------------- | ----------------- |
| `feat!:` or `BREAKING CHANGE:`               | `1.0.0` (major)   |
| `feat:`                                      | `0.1.0` (minor)   |
| anything else (`fix:`, `chore:`, `docs:`, …) | `0.0.2` (patch)   |

Squash-merge is the convention: the PR title becomes the commit subject, so it is also the versioning input. Keep merge commits and rebase-merge unused even if GitHub still allows them.

Every allowed type maps to at least a patch. A manual run with only `chore:` / `docs:` commits still ships, because a dispatch is a deliberate "ship this". Releases never run on merge, so this cannot leak accidental versions.

## Jobs

**Release** (`release.yml`) is `workflow_dispatch` only, and must be run with branch `main` selected:

1. **Quality gate** — `eslint`, `prettier --check`, `tsc -b` on Ubuntu with `npm ci --ignore-scripts`.
2. **Version** — `semantic-release` bumps `package.json` / `package-lock.json`, prepends `CHANGELOG.md`, commits `chore(release): x.y.z [skip ci]` to `main`, and tags `vX.Y.Z`.
3. **Build & publish** — calls the reusable workflow below with that tag.

**Build & Publish Release** (`build-release.yml`) is reusable and also dispatchable on its own (bootstrap and retry):

1. Package unsigned installers in parallel: macOS arm64 `.dmg` on `macos-15`, Windows x64 portable `.exe` + `.msi` on `windows-latest`. `CSC_IDENTITY_AUTO_DISCOVERY=false` so electron-builder does not look for a signing identity. `--publish never` so it does not try to create a GitHub Release itself (CI would otherwise demand `GH_TOKEN` after the DMG is already built).
2. Create (or update) one GitHub Release with the installers and notes taken from the top `CHANGELOG.md` section, plus the macOS `xattr` instruction.

Artifact names are `${name}-${version}-${os}-${arch}.${ext}`, for example `git-mastery-0.0.1-mac-arm64.dmg`. `latest*.yml` and `.blockmap` files are not attached; there is no in-app updater.

PR workflows:

- **CI** — same quality checks as the release gate, on every PR and every push to `main`.
- **PR lint** — conventional title (`feat` / `fix` / `docs` / `chore` / `refactor` / `perf` / `build` / `ci` / `style` / `test` / `revert`, lowercase subject, no trailing period) and a body with non-empty `## Overview`, `## Solution`, and `## Test cases` (at least one checkbox). Drafts are skipped. A failure comment is best-effort: fork PRs may not have write access, so that step is `continue-on-error`.

## Bootstrap (first release)

`package.json` starts at `0.0.1`. semantic-release would otherwise treat a repo with no tags as `1.0.0`, so the first tag is created by hand:

1. Confirm `package.json` reads `0.0.1`.
2. `git tag v0.0.1 && git push origin v0.0.1`.
3. Run **Build & Publish Release** against ref `v0.0.1`.
4. Later releases are only **Release**, which bumps off `v0.0.1`.

Do not push the leftover local tags `v1.0.0` / `v1.0.0a`; semantic-release would then bump from `1.0.0`.

## Recovery

The version commit and tag land before the installers exist. If a platform build fails, `main` already has the bump and no GitHub Release (or an incomplete one). Re-run **Build & Publish Release** on that tag once the build is fixed. The publish job updates an existing release in place.

## Unsigned builds

There is no Apple or Windows signing certificate in CI, and this repo does not require secrets. macOS users still need:

```bash
xattr -rc /Applications/git-mastery.app
```

## Rejected alternatives

- **Release on every merge to `main`.** Builds compile `node-pty` on two OSes and take several minutes. Shipping should be an explicit action.
- **release-please.** Built around an always-open release PR. That is a different product shape than "run when we want to ship", and the extra PR is noise for a desktop app with infrequent cuts.
- **commit-and-tag-version.** Hard-codes `preMajor` below `1.0.0`, so `feat:` becomes a patch and a breaking change becomes a minor. That contradicts strict semver.
- **`@semantic-release/github` creating the release in the version job.** The GitHub Release would be public with no binaries for the whole packaging window, and a failed build would leave it empty. Creating the release after both artifacts land avoids that.
- **Dry-run semantic-release, build, then a real run.** Commit analysis would run twice and can disagree if `main` moved. Accepted tradeoff: tag first, retry the build workflow if packaging fails.
- **Force-patch via a second hand-rolled path when semantic-release reports "no release".** Mapping every type to patch in `commit-analyzer` is one path and matches "dispatch means ship".
