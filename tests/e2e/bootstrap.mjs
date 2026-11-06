import { app } from "electron";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import path from "node:path";
import pty from "node-pty";
import { responses } from "./site.mjs";
import "../../dist-electron/main.js";

// Static import registers the real ready handler; these hooks run before ready.
app.setAppPath(process.env.GM_E2E_REPO);
const spawn = childProcess.spawn;
childProcess.spawn = function (command, ...args) {
  if (/^gitmastery(?:\.exe)?$/i.test(path.basename(command))) {
    command = process.env.GM_E2E_CLI;
    if (process.platform === "win32") {
      args[0] = [process.env.GM_E2E_CLI_SCRIPT, ...args[0]];
    }
  }
  return spawn.call(this, command, ...args);
};
syncBuiltinESMExports();

if (process.platform === "win32") {
  // Track real PTYs for test-owned cleanup. Leaving ConPTY alive while
  // Electron quits hangs shutdown and keeps the temporary cwd locked.
  const terminals = new Set();
  const spawnTerminal = pty.spawn;
  pty.spawn = function (...args) {
    const terminal = spawnTerminal.apply(this, args);
    terminals.add(terminal);
    terminal.onExit(() => terminals.delete(terminal));
    return terminal;
  };
  app.on("before-quit", () => {
    for (const terminal of terminals) terminal.kill();
  });
}

const configured = new WeakSet();
app.on("web-contents-created", (_event, contents) => {
  const session = contents.session;
  if (configured.has(session)) return;
  configured.add(session);
  for (const scheme of ["https", "http"]) {
    session.protocol.handle(scheme, (request) => {
      const url = new URL(request.url);
      url.hash = "";
      const response = responses.get(url.href);
      fs.appendFileSync(
        process.env.GM_E2E_NETWORK_LOG,
        JSON.stringify({ url: url.href, allowed: Boolean(response) }) + "\n",
      );
      if (!response)
        return new Response("Unexpected E2E request", { status: 503 });
      const [type, body] = response;
      return new Response(body, {
        headers: {
          "content-type": type,
          "access-control-allow-origin": "*",
        },
      });
    });
  }
});
