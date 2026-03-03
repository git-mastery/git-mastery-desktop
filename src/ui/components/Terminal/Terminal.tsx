import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const XTermComponent = () => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({ cursorBlink: true });
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Spawn the shell process with the actual terminal dimensions
    window.electron.spawn(term.cols, term.rows);

    // Keep pty in sync whenever the terminal is resized
    term.onResize(({ cols, rows }) => {
      window.electron.resize(cols, rows);
    });

    // Refit xterm when the container element resizes
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(terminalRef.current);

    // Setup communication between xterm.js and node-pty via IPC
    term.onData(data => window.electron.write(data));
    const removeDataListener = window.electron.onData(data => term.write(data));

    return () => {
      observer.disconnect();
      removeDataListener();
      term.dispose();
    };
  }, [terminalRef.current]);

  return (
    <div
      ref={terminalRef}
      style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
    />
  );
};

export default XTermComponent;