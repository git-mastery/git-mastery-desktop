# Git-Mastery Desktop app Developer Guide

## Installing

1. Clone the repository:

```
git clone https://github.com/HollaG/electron-git-mastery.git
```

2. cd into it:

```
cd electron-git-mastery
```

3. Install dependencies:

```
npm install
```

## Developing

Start the application:

```
npm run dev
```

Notes:

- `npm run dev` starts both Electron backend & React frontend

## Building

Note: The build process takes quite a while. Be patient and let it finish

### Windows

```
npm run dist:win
```

Run the .exe to open the app.

Potential errors:

### Error: Could not find any Visual Studio installation to use

```
Error: Could not find any Visual Studio installation to use
    at VisualStudioFinder.fail (I:\Coding\electron\electron-git-mastery\node_modules\node-gyp\lib\find-visualstudio.js:118:11)
    at VisualStudioFinder.findVisualStudio (I:\Coding\electron\electron-git-mastery\node_modules\node-gyp\lib\find-visualstudio.js:74:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async createBuildDir (I:\Coding\electron\electron-git-mastery\node_modules\node-gyp\lib\configure.js:112:18)
    at async process.<anonymous> (file:///I:/Coding/electron/electron-git-mastery/node_modules/@electron/rebuild/lib/module-type/node-gyp/worker.js:22:13)
```

Fix: install Visual Studio Build Tools

1. Download Visual Studio Build Tools
   https://visualstudio.microsoft.com/visual-cpp-build-tools/

2. In the installer, select:

   > Desktop development with C++

3. Make sure these are included:

- MSVC v143 C++ build tools

- Windows 10/11 SDK

- C++ CMake tools for Windows

4. Restart terminal / VS Code.

5. Run the command again.

### Error: Missing Spectre-mitigated libraries

```
C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Microsoft\VC\v180\Microsoft.CppBuild.targets(524,5): error MSB8040: Spectre-mitigated libraries are required for this project. Install them from the Visual Studio installer (Individual components tab) for any toolsets and architectures being used. Learn more: https://aka.ms/Ofhn4c [I:\Coding\electron\electron-git-mastery\node_modules\node-pty\build\conpty.vcxproj]
```

Fix: Install [Spectre libraries](https://chatgpt.com/s/t_69ee079450d88191b6407ea2876ce5d7)

### MacOS

```
npm run dist:mac
```

Outputs:

1. `.dmg` in `dist/git-mastery-{version}-arm64.dmg`

2. `.app` (portable) in `dist/mac-arm64/git-mastery.app`

Special note for MacOS: Due to Apple restricting unsigned builds, users must run the following command before opening the app:

```
xattr -rc /Applications/git-mastery.app
```

Failure to run this command will result in an error saying that the app can't be opened.

### Linux

```
npm run dist:linux
```
