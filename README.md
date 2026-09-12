# Git-Mastery Desktop

Companion app for [git-mastery.org](https://git-mastery.org). Electron-based, cross-platform client for [GitMastery](https://github.com/git-mastery).

Linux support is still in development.

## Download

Grab the latest release from [GitHub Releases](https://github.com/git-mastery/git-mastery-desktop/releases).

**Windows:** run the `.exe` (portable) or the `.msi` installer.

**macOS:** install the `.dmg`, then clear the quarantine flag (required for unsigned builds):

```bash
xattr -rc /Applications/git-mastery.app
```

Without this, macOS reports that the app can't be opened.

**Linux:** not officially supported.

## Development

```bash
git clone https://github.com/git-mastery/git-mastery-desktop.git
cd git-mastery-desktop
npm install
npm run dev
```

`npm run dev` starts the React frontend and Electron backend together.

### Packaging

Builds take a while. The Dock / installer / `.exe` icon is `resources/icon.png` — see [packaging.md](docs/development/packaging.md).

| Platform | Command              | Output                                                                                |
| -------- | -------------------- | ------------------------------------------------------------------------------------- |
| Windows  | `npm run dist:win`   | `dist/git-mastery-{version}-win-x64.exe` and `dist/git-mastery-{version}-win-x64.msi` |
| macOS    | `npm run dist:mac`   | `dist/git-mastery-{version}-mac-arm64.dmg`                                            |
| Linux    | `npm run dist:linux` | AppImage / dist artifacts (unsupported)                                               |

macOS users of an unsigned build still need the `xattr` command above after installing.

#### Windows build tools

`node-pty` needs native compilation. If the build fails:

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++**, including MSVC v143, the Windows 10/11 SDK, and C++ CMake tools.
2. If you see `MSB8040` (Spectre-mitigated libraries required), add those libraries from the Visual Studio Installer → Individual components.
3. Restart the terminal and retry.

### Cutting a release

Releases are manual. Details, versioning rules, and bootstrap steps are in [release-pipeline.md](docs/development/release-pipeline.md).

1. Merge PRs to `main` with conventional titles (`feat:`, `fix:`, …). Squash-merge so the title is the commit.
2. On GitHub: **Actions → Release → Run workflow**, with branch `main`.
3. The workflow bumps the version from commits since the last tag, builds macOS arm64 and Windows x64 installers, and publishes a GitHub Release.

For the very first `v0.0.1` cut, tag it by hand and run **Build & Publish Release** against that tag — see the bootstrap section in the pipeline doc.
