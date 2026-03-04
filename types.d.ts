interface Window {
  electron: {
    spawn: (cols: number, rows: number) => void;
    write: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    resize: (cols: number, rows: number) => void;
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
  "pty-data": string
}