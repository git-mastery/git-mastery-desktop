#!/usr/bin/env python3
"""Build Google Docs batchUpdate requests from docs/preliminary-report.md."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORT_MD = REPO_ROOT / "docs/preliminary-report.md"
IMAGES_DIR = REPO_ROOT / "docs/images/preliminary-report"
DEFAULT_DOC_ID = "1dEZLPJueNZuci8KqFgeVpuJ4G4m69blgsr9CwyF8G_E"


@dataclass
class Block:
    kind: str
    text: str = ""
    style: str | None = None
    image_path: str | None = None
    image_width_pt: float | None = None


def git_branch() -> str:
    return (
        subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        )
        .strip()
    )


def image_public_url(relative_path: str, branch: str) -> str:
    rel = relative_path.replace("images/preliminary-report/", "")
    return (
        "https://raw.githubusercontent.com/git-mastery/git-mastery-desktop/"
        f"{branch}/docs/images/preliminary-report/{rel}"
    )


def image_width_pt(path: Path) -> float:
    try:
        out = subprocess.check_output(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        width = height = 0
        for line in out.splitlines():
            if "pixelWidth:" in line:
                width = int(line.split(":")[1].strip())
            if "pixelHeight:" in line:
                height = int(line.split(":")[1].strip())
        if width <= 0 or height <= 0:
            return 468.0
        max_width = 468.0
        scale = min(1.0, max_width / width)
        return round(width * scale * 0.75, 1)
    except Exception:
        return 468.0


def parse_markdown(md: str, branch: str) -> list[Block]:
    blocks: list[Block] = []
    lines = md.splitlines()
    i = 0
    image_re = re.compile(r"!\[(.*?)\]\((images/preliminary-report/[^)]+)\)")
    html_img_re = re.compile(
        r'<img src="(images/preliminary-report/[^"]+)"[^>]*width="(\d+)"'
    )

    while i < len(lines):
        line = lines[i]

        if line.strip().startswith("> Source:"):
            i += 1
            while i < len(lines) and lines[i].strip().startswith(">"):
                i += 1
            continue

        if line.strip() == '<div style="page-break-after: always;"></div>':
            blocks.append(Block(kind="page_break"))
            i += 1
            continue

        if line.strip() in {"<br>", "<br/>", "<br />"}:
            i += 1
            continue

        if line.strip().startswith('<p align="center">'):
            para_lines = [line]
            i += 1
            while i < len(lines) and "</p>" not in para_lines[-1]:
                para_lines.append(lines[i])
                i += 1
            para_html = "\n".join(para_lines)
            html_match = html_img_re.search(para_html)
            if html_match:
                rel = html_match.group(1)
                width_px = int(html_match.group(2))
                path = REPO_ROOT / "docs" / rel
                blocks.append(
                    Block(
                        kind="image",
                        image_path=image_public_url(rel, branch),
                        image_width_pt=round(width_px * 0.75, 1),
                    )
                )
                continue
            inner = re.sub(r"</?p[^>]*>", "", para_html)
            inner = re.sub(r"</?strong>", "", inner)
            inner = inner.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
            inner = inline_text(inner.strip())
            if inner:
                blocks.append(Block(kind="paragraph", text=inner))
            continue

        html_match = html_img_re.search(line)
        if html_match:
            rel = html_match.group(1)
            width_px = int(html_match.group(2))
            path = REPO_ROOT / "docs" / rel
            blocks.append(
                Block(
                    kind="image",
                    image_path=image_public_url(rel, branch),
                    image_width_pt=round(width_px * 0.75, 1),
                )
            )
            i += 1
            continue

        if line.startswith("<p align=\"center\">") or line.startswith("</p>"):
            i += 1
            continue

        h1 = re.match(r"<h1 align=\"center\">(.*)</h1>", line)
        if h1:
            blocks.append(Block(kind="heading", style="HEADING_1", text=h1.group(1)))
            i += 1
            continue

        h2 = re.match(r"<h2 align=\"center\">(.*)</h2>", line)
        if h2:
            blocks.append(Block(kind="heading", style="HEADING_2", text=h2.group(1)))
            i += 1
            continue

        if line.startswith("<p align=\"center\">") and line.endswith("</p>"):
            inner = re.sub(r"</?[^>]+>", "", line)
            inner = inner.replace("<strong>", "").replace("</strong>", "")
            inner = inner.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
            blocks.append(Block(kind="paragraph", text=inner.strip()))
            i += 1
            continue

        if line.startswith("## "):
            blocks.append(Block(kind="heading", style="HEADING_1", text=line[3:].strip()))
            i += 1
            continue

        if line.startswith("### "):
            blocks.append(Block(kind="heading", style="HEADING_2", text=line[4:].strip()))
            i += 1
            continue

        if line.startswith("#### "):
            blocks.append(Block(kind="heading", style="HEADING_3", text=line[5:].strip()))
            i += 1
            continue

        img_match = image_re.match(line.strip())
        if img_match:
            rel = img_match.group(2)
            path = REPO_ROOT / "docs" / rel
            blocks.append(
                Block(
                    kind="image",
                    image_path=image_public_url(rel, branch),
                    image_width_pt=image_width_pt(path),
                )
            )
            i += 1
            if i < len(lines) and lines[i].startswith("_Figure"):
                blocks.append(
                    Block(
                        kind="caption",
                        text=lines[i].strip().strip("_"),
                    )
                )
                i += 1
            continue

        if line.startswith("_Figure") and line.endswith("_"):
            blocks.append(Block(kind="caption", text=line.strip().strip("_")))
            i += 1
            continue

        if line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(lines[i][2:].strip())
                i += 1
            blocks.append(Block(kind="bullets", text="\n".join(items)))
            continue

        if re.match(r"^\d+\.\s", line):
            items = []
            while i < len(lines) and re.match(r"^\d+\.\s", lines[i]):
                items.append(re.sub(r"^\d+\.\s", "", lines[i]).strip())
                i += 1
            blocks.append(Block(kind="numbered", text="\n".join(items)))
            continue

        if line.startswith("> "):
            quote_lines = []
            while i < len(lines) and lines[i].startswith("> "):
                quote_lines.append(lines[i][2:].strip())
                i += 1
            blocks.append(Block(kind="quote", text="\n".join(quote_lines)))
            continue

        if not line.strip():
            i += 1
            continue

        para_lines = [line.strip()]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if (
                not nxt.strip()
                or nxt.startswith("#")
                or nxt.startswith("- ")
                or nxt.startswith(">")
                or nxt.startswith("!")
                or nxt.startswith("<")
                or nxt.startswith("_Figure")
                or re.match(r"^\d+\.\s", nxt)
            ):
                break
            para_lines.append(nxt.strip())
            i += 1
        blocks.append(Block(kind="paragraph", text=" ".join(para_lines)))
    return blocks


def inline_text(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", text)
    text = text.replace("**", "")
    text = text.replace("`", "")
    return text


def end_location() -> dict:
    return {"endOfSegmentLocation": {}}


def build_delete_request(end_index: int) -> dict:
    return {
        "deleteContentRange": {"range": {"startIndex": 1, "endIndex": end_index - 1}}
    }


def build_insert_requests(blocks: list[Block]) -> list[dict]:
    requests: list[dict] = []
    for block in blocks:
        if block.kind == "page_break":
            requests.append({"insertPageBreak": {"location": end_location()}})
            continue

        if block.kind == "image":
            width = block.image_width_pt or 468.0
            height = round(width * 0.56, 1)
            requests.append(
                {
                    "insertInlineImage": {
                        "location": end_location(),
                        "uri": block.image_path,
                        "objectSize": {
                            "width": {"magnitude": width, "unit": "PT"},
                            "height": {"magnitude": height, "unit": "PT"},
                        },
                    }
                }
            )
            requests.append({"insertText": {"location": end_location(), "text": "\n"}})
            continue

        if block.kind == "bullets":
            lines = [inline_text(line) for line in block.text.split("\n") if line.strip()]
            text = "\n".join(f"- {line}" for line in lines) + "\n"
            requests.append({"insertText": {"location": end_location(), "text": text}})
            continue

        if block.kind == "numbered":
            lines = [inline_text(line) for line in block.text.split("\n") if line.strip()]
            text = "\n".join(f"{idx}. {line}" for idx, line in enumerate(lines, start=1)) + "\n"
            requests.append({"insertText": {"location": end_location(), "text": text}})
            continue

        if block.kind in {"quote", "caption"}:
            text = inline_text(block.text) + "\n"
            requests.append({"insertText": {"location": end_location(), "text": text}})
            continue

        if block.kind == "heading":
            text = inline_text(block.text) + "\n"
            requests.append({"insertText": {"location": end_location(), "text": text}})
            continue

        text = inline_text(block.text) + "\n"
        requests.append({"insertText": {"location": end_location(), "text": text}})
    return requests


def build_request_groups(blocks: list[Block], end_index: int) -> list[list[dict]]:
    return [[build_delete_request(end_index)], build_insert_requests(blocks)]


def chunk_requests(requests: list[dict], size: int) -> list[list[dict]]:
    return [requests[i : i + size] for i in range(0, len(requests), size)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--document-id", default=DEFAULT_DOC_ID)
    parser.add_argument("--end-index", type=int, required=True)
    parser.add_argument("--branch", default=None)
    parser.add_argument("--chunk-size", type=int, default=35)
    parser.add_argument("--out-dir", default="/tmp/gdocs-preliminary-sync")
    args = parser.parse_args()

    branch = args.branch or git_branch()
    md = REPORT_MD.read_text(encoding="utf-8")
    blocks = parse_markdown(md, branch)
    groups = build_request_groups(blocks, args.end_index)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    chunks: list[list[dict]] = []
    for group in groups:
        chunks.extend(chunk_requests(group, args.chunk_size))

    manifest = {
        "documentId": args.document_id,
        "branch": branch,
        "blockCount": len(blocks),
        "requestCount": sum(len(chunk) for chunk in chunks),
        "chunkCount": len(chunks),
        "chunks": [],
    }
    for idx, chunk in enumerate(chunks, start=1):
        path = out_dir / f"batch-{idx:02d}.json"
        payload = {"documentId": args.document_id, "requests": chunk}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        manifest["chunks"].append(str(path))
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
