import { describe, expect, it } from "vitest";
import { formatAttachedContext } from "../../../src/electron/ai/prompt.js";
import {
  assembleProviderMessages,
  MAX_PROVIDER_TURNS,
  selectProviderHistory,
} from "../../../src/electron/ai/providerMessages.js";
import {
  lessonSource,
  workspaceSource,
} from "../../../src/electron/ai/source.js";

function message(
  id: string,
  role: "user" | "assistant",
  text: string,
): GitMasteryUIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

describe("selectProviderHistory", () => {
  it("keeps the latest user message and at most two earlier turns", () => {
    const messages = [
      message("u1", "user", "first"),
      message("a1", "assistant", "old diagnosis"),
      message("u2", "user", "second"),
      message("a2", "assistant", "still missing"),
      message("u3", "user", "third"),
      message("a3", "assistant", "added it"),
      message("u4", "user", "i already did that"),
    ];
    const { prior, latest } = selectProviderHistory(messages);
    expect(MAX_PROVIDER_TURNS).toBe(2);
    expect(latest?.id).toBe("u4");
    expect(prior.map((item) => item.id)).toEqual(["u2", "a2", "u3", "a3"]);
  });

  it("drops a leading assistant fragment", () => {
    const { prior, latest } = selectProviderHistory([
      message("a0", "assistant", "orphan"),
      message("u1", "user", "hello"),
    ]);
    expect(prior).toEqual([]);
    expect(latest?.id).toBe("u1");
  });
});

describe("assembleProviderMessages", () => {
  it("puts fresh evidence after history and before the current question", async () => {
    const messages = await assembleProviderMessages({
      source: workspaceSource("link-me"),
      messages: [
        message("u1", "user", "I'm stuck"),
        message("a1", "assistant", "No remotes yet"),
        message("u2", "user", "i already did that"),
      ],
      blocks: [
        {
          id: "git-state",
          label: "Repository state",
          text: "Configured remotes: upstream",
        },
      ],
    });
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "I'm stuck" }],
    });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "No remotes yet" }],
    });
    const last = messages[2];
    expect(last?.role).toBe("user");
    expect(
      last && typeof last.content === "string" ? last.content : "",
    ).toContain("Untrusted workspace evidence for this turn only");
    expect(
      last && typeof last.content === "string" ? last.content : "",
    ).toContain("Configured remotes: upstream");
    expect(
      last && typeof last.content === "string" ? last.content : "",
    ).toContain("# Student message");
    expect(
      last && typeof last.content === "string" ? last.content : "",
    ).toContain("i already did that");
  });

  it("does not attach workspace evidence to lesson chats", async () => {
    const messages = await assembleProviderMessages({
      source: lessonSource("gitPrep", "Git prep"),
      messages: [message("u1", "user", "What is a remote?")],
      blocks: [
        { id: "git-state", label: "Repository state", text: "should stay out" },
      ],
    });
    expect(messages).toEqual([{ role: "user", content: "What is a remote?" }]);
  });
});

it("formatAttachedContext fences blocks without putting them in the system prompt", () => {
  const attached = formatAttachedContext([
    { id: "instructions", label: "Instructions", text: "## Task" },
  ]);
  expect(attached).toContain("## Instructions");
  expect(attached).toContain("## Task");
});
