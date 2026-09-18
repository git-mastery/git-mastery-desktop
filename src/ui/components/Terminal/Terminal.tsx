import { useEffect, useRef } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "../../contexts/ThemeContext";
import type { ResolvedTheme } from "../../utils/theme";

/** Background sits slightly off chrome so the pane reads as a terminal. */
const XTERM_THEMES: Record<ResolvedTheme, ITheme> = {
  light: {
    background: "#f1f3f4",
    foreground: "#333333",
    cursor: "#333333",
    selectionBackground: "#e1f4e8",
    green: "#2d864e",
    red: "#b42318",
    yellow: "#b54708",
    cyan: "#0369a1",
  },
  dark: {
    background: "#1a1d20",
    foreground: "#dee2e6",
    cursor: "#dee2e6",
    selectionBackground: "#343a40",
    green: "#75b798",
    red: "#ea868f",
    yellow: "#ffda6a",
    cyan: "#6edff6",
  },
};

const XTermComponent = () => {
  const { resolved } = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const initial =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const term = new Terminal({
      cursorBlink: true,
      theme: XTERM_THEMES[initial],
    });
    const fitAddon = new FitAddon();
    termRef.current = term;

    term.loadAddon(fitAddon);
    term.open(wrapperRef.current);
    fitAddon.fit();

    // Spawn the shell process with the actual terminal dimensions
    window.electron.spawn(term.cols, term.rows);

    // Keep pty in sync whenever the terminal is resized
    term.onResize(({ cols, rows }) => {
      window.electron.resize(cols, rows);
    });

    // Refit xterm when the container element resizes
    let fitRaf = 0;
    const observer = new ResizeObserver(() => {
      if (fitRaf) return;
      fitRaf = requestAnimationFrame(() => {
        fitRaf = 0;
        fitAddon.fit();
      });
    });
    observer.observe(wrapperRef.current);

    // Setup communication between xterm.js and node-pty via IPC
    term.onData((data) => window.electron.write(data));
    const removeDataListener = window.electron.onData((data) =>
      term.write(data),
    );
    return () => {
      cancelAnimationFrame(fitRaf);
      observer.disconnect();
      removeDataListener();
      termRef.current = null;
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = XTERM_THEMES[resolved];
  }, [resolved]);

  return <div ref={wrapperRef} className="h-full w-full bg-terminal" />;
};

export default XTermComponent;
