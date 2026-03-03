interface Window {
  electron: {
    spawn: () => void;
    write: (data: string) => void;
    onData: (callback: (data: string) => void) => () => void;
    resize: (cols: number, rows: number) => void;
  }
}