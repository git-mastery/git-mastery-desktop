# Development requirements
You are developing as part of a 6-month university course. As such, many developers over the course of years will touch this code. Each time you make a change, you must update the documentation to reflect the change. If documentation does not exist, add it in `/docs`.

## Electron Build Boundary Rule

**Never import files from outside `src/electron/` in any file inside `src/electron/`** (including `preload.cts`, `main.ts`, and files in `ipc/`).

The electron TypeScript config (`src/electron/tsconfig.json`) only covers `src/electron/**`. When a file inside `src/electron/` imports from a sibling directory (e.g. `../../shared/constants.js`), TypeScript recalculates the implicit `rootDir` to be the common ancestor (`src/`). This causes all compiled output to be nested one level deeper (e.g. `dist-electron/electron/main.js` instead of `dist-electron/main.js`), which breaks Electron startup since `package.json` expects `dist-electron/main.js`.

**The fix:** Inline any shared constants or utilities directly inside `src/electron/`. Do not create cross-directory imports from within `src/electron/`.