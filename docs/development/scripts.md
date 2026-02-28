# package.json scripts

`npm run transpile:electron`
This script transpiles the Electron code written in TypeScript to JavaScript. You must transpile if you have made changes in Electron code (under `/src/electron`)

`npm run dev:react`
This script runs the React development server. You can access the app at `http://localhost:5123`. You must run this before running Electron in Development mode.

`npm run dev:electron`
This script runs the Electron app in development mode after transpiling. It will open the Electron window.

`npm run dev`
This script runs both `npm run dev:react` and `npm run dev:electron` in parallel.