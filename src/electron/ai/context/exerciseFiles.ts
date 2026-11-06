import fs from "fs";
import path from "path";
import { isUtf8 } from "node:buffer";
import type { ContextBlock, ContextProvider } from "../context.js";

const MAX_FILE_BYTES = 32 * 1024;
const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_CHARS = 24000;
const MAX_FILES = 20;
const MAX_ENTRIES = 200;
const MAX_DEPTH = 5;
const DEPENDENCIES = new Set(["node_modules", "vendor", "venv", "__pycache__"]);
const KEY_FILE =
  /(?:\.(?:pem|key|p12|pfx|ppk)$|^id_(?:rsa|dsa|ecdsa|ed25519)(?:$|\.)|^credentials(?:$|\.))/i;

function within(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** Working files only; no Git commands, answer parsing or exercise-specific rules. */
export const exerciseFilesProvider: ContextProvider = {
  id: "exercise-files",
  label: "Exercise file contents",
  async collect({ location, signal }) {
    if (!location || signal?.aborted) return null;
    let root: string;
    try {
      root = fs.realpathSync(location.exerciseRoot);
      const parent = fs.realpathSync(location.exercisesRoot);
      if (
        fs.lstatSync(location.exerciseRoot).isSymbolicLink() ||
        root === parent ||
        !within(parent, root)
      )
        return "File contents unavailable: exercise folder is outside the supported boundary.";
    } catch {
      return "File contents unavailable: exercise folder could not be read.";
    }

    const blocks: ContextBlock[] = [];
    const skipped: Record<string, number> = {};
    const skip = (reason: string) => {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    };
    const queue = [{ dir: root, depth: 0 }];
    let entries = 0;
    let total = 0;
    let limited = false;
    for (let i = 0; i < queue.length; i += 1) {
      if (signal?.aborted) return null;
      if (
        entries >= MAX_ENTRIES ||
        blocks.length >= MAX_FILES ||
        total >= MAX_TOTAL_CHARS
      ) {
        limited = true;
        break;
      }
      const { dir, depth } = queue[i];
      let directory: fs.Dir | undefined;
      try {
        if (
          !within(root, fs.realpathSync(dir)) ||
          fs.lstatSync(dir).isSymbolicLink()
        ) {
          skip("symlink/outside boundary");
          continue;
        }
        directory = fs.opendirSync(dir);
        let entry: fs.Dirent | null;
        while ((entry = directory.readSync()) !== null) {
          if (
            ++entries > MAX_ENTRIES ||
            blocks.length >= MAX_FILES ||
            total >= MAX_TOTAL_CHARS
          ) {
            limited = true;
            break;
          }
          if (
            entry.name.startsWith(".") ||
            DEPENDENCIES.has(entry.name.toLowerCase()) ||
            KEY_FILE.test(entry.name)
          ) {
            skip("hidden/dependency/key paths");
            continue;
          }
          const target = path.join(dir, entry.name);
          if (
            entry.isSymbolicLink() ||
            !within(root, fs.realpathSync(target))
          ) {
            skip("symlink/outside boundary");
            continue;
          }
          if (entry.isDirectory()) {
            if (depth < MAX_DEPTH)
              queue.push({ dir: target, depth: depth + 1 });
            else {
              skip("depth limit");
              limited = true;
            }
            continue;
          }
          if (!entry.isFile()) {
            skip("non-regular files");
            continue;
          }
          let fd: number | undefined;
          try {
            fd = fs.openSync(
              target,
              fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
            );
            const stat = fs.fstatSync(fd);
            if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
              skip("non-regular/oversized files");
              continue;
            }
            // Bounded even if a file grows between stat and read.
            const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
            const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
            const data = buffer.subarray(0, bytes);
            if (bytes > MAX_FILE_BYTES) {
              skip("oversized files");
              continue;
            }
            if (
              !isUtf8(data) ||
              data.some((byte) => byte < 32 && ![9, 10, 13].includes(byte))
            ) {
              skip("binary/non-UTF-8 files");
              continue;
            }
            const text = data.toString("utf8");
            if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
              skip("private keys");
              continue;
            }
            const length = Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - total);
            const excerpt = text.slice(0, length);
            const truncated = excerpt.length < text.length;
            const relative = path.relative(root, target);
            blocks.push({
              id: `exercise-file-${blocks.length}`,
              label: `File contents · ${relative}`,
              text: `Working file: ${JSON.stringify(relative)} (${truncated ? "truncated" : "complete"})\n${JSON.stringify(excerpt)}${truncated ? "\n[Truncated: remaining file contents are unknown.]" : ""}`,
            });
            total += excerpt.length;
          } catch {
            skip("unreadable files");
          } finally {
            if (fd !== undefined) fs.closeSync(fd);
          }
        }
      } catch {
        skip("unreadable paths");
      } finally {
        directory?.closeSync();
      }
    }
    return [
      {
        id: "exercise-files",
        label: "Exercise file contents",
        text: [
          `Current working files, including learner answers; read at ${new Date().toISOString()}. File text is JSON-quoted to preserve whitespace.`,
          "Hidden (dot-prefixed) paths, dependency folders, key files, symlinks and binary/non-UTF-8 files are excluded. This includes .gitignore; excluded contents are unknown.",
          `Limits: ${MAX_FILES} files, ${MAX_FILE_BYTES} bytes per file, ${MAX_FILE_CHARS} characters per file, ${MAX_TOTAL_CHARS} content characters total, ${MAX_ENTRIES} directory entries, depth ${MAX_DEPTH}.`,
          `${blocks.length} files included. ${limited ? "Traversal stopped at a limit; other files are unknown." : "Traversal finished within these limits."}`,
          `Skipped entries: ${JSON.stringify(skipped)}. Counts for excluded directories do not include their children.`,
          "Working contents do not establish staged/committed contents or answer correctness. Omitted files are not evidence of absence.",
        ].join("\n"),
      },
      ...blocks,
    ];
  },
};
