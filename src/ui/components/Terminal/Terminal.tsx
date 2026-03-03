import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";


const XTermComponent = () => {
  // Pass URL as a prop
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({ cursorBlink: true });
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();
    // Spawn the shell process
    window.electron.spawn();

    // Setup communication between xterm.js and node-pty via IPC
    term.onData(data => window.electron.write(data));
    const removeDataListener = window.electron.onData(data => term.write(data));

    return () => {
      removeDataListener();
      term.dispose();
    };
  }, [terminalRef.current]);

  return (
    <div
      ref={terminalRef}
      style={{ width: "100%", height: "100%", backgroundColor: "#191919" }}
    />
  );
};

export default XTermComponent;