interface Window {
  electron: {
    spawn: (cols: number, rows: number) => void;
    write: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    resize: (cols: number, rows: number) => void;

    // for Web Contents View
    display: (x: number, y: number, width: number, height: number) => void;
    navigate: (url: string) => void;

  }
}

// type EventPayloadMapping = {
//   spawn: void,
//   write: void,
//   onData: () => void,
//   resize: void
// }

// key:
type IpcHandlerChannelMapping = {
  "pty-spawn": { cols: number, rows: number },
  "pty-write": { data: string },
  "pty-resize": { cols: number, rows: number },
  "pty-data": string,
  "wcv-navigate": { url: string },
  "wcv-display": { x: number, y: number, width: number, height: number },
}