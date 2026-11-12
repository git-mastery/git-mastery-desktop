import path from "path";
import { fileURLToPath } from "url";
import type { ContextBlock } from "../context.js";
import { contained, GitReader, realpath } from "./gitReader.js";

const MAX_REFS = 20;
const MAX_BRANCHES = 4;
const MAX_TAGS = 12;
const MAX_REMOTES = 3;
const MAX_TARGETS = 4;
const MAX_LOG = 8;
const MAX_REFLOG = 6;
const UNKNOWN =
  "unknown: command failed, timed out, or exceeded collection limits";

type Ref = {
  name: string;
  oid: string;
  type: string;
  upstream: string | null;
  symbolic: string | null;
};

async function refs(
  git: GitReader,
  repo: string,
  prefix: string,
): Promise<Ref[] | null> {
  const output = await git.read(repo, [
    "for-each-ref",
    `--count=${MAX_REFS + 1}`,
    "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(symref)",
    prefix,
  ]);
  if (output === null) return null;
  return output
    ? output.split("\n").map((line) => {
        const [name, oid, type, upstream, symbolic] = line.split("\0");
        return {
          name,
          oid,
          type,
          upstream: upstream || null,
          symbolic: symbolic || null,
        };
      })
    : [];
}

function completeness(entries: Ref[] | null, limit: number): string {
  if (!entries) return UNKNOWN;
  return entries.length > limit
    ? `partial, first ${limit}; omitted refs unknown`
    : "complete";
}

function shortRef(ref: Ref): string {
  return `${ref.name} oid=${ref.oid}${ref.symbolic ? ` symbolic=${ref.symbolic}` : ""}`;
}

async function compare(
  git: GitReader,
  repo: string,
  left: Ref,
  right: Ref,
): Promise<string> {
  if (left.oid === right.oid)
    return `${left.name} = ${right.name}: identical tips (${left.oid})`;
  const counts = await git.read(repo, [
    "rev-list",
    "--left-right",
    "--count",
    `${left.oid}...${right.oid}`,
  ]);
  if (!counts) return `${left.name} vs ${right.name}: ${UNKNOWN}`;
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  return `${left.name} vs ${right.name}: ahead=${ahead}, behind=${behind}; ${
    ahead === 0
      ? "left is ancestor of right"
      : behind === 0
        ? "right is ancestor of left"
        : "diverged (or unrelated)"
  }`;
}

async function branchEvidence(
  git: GitReader,
  repo: string,
  branches: Ref[] | null,
  tracking: Ref[] | null,
  tags: Ref[] | null,
): Promise<string> {
  const relations = await Promise.all(
    (branches ?? []).slice(0, MAX_BRANCHES).map(async (branch) => {
      const name = branch.name.slice("refs/heads/".length);
      const matches = (tracking ?? []).filter(
        (ref) =>
          !ref.symbolic &&
          ref.name
            .slice("refs/remotes/".length)
            .split("/")
            .slice(1)
            .join("/") === name,
      );
      const upstream =
        tracking?.find((ref) => ref.name === branch.upstream) ??
        branches?.find((ref) => ref.name === branch.upstream);
      const pairs = [
        ...new Map(
          [...matches, ...(upstream ? [upstream] : [])].map((ref) => [
            ref.name,
            ref,
          ]),
        ).values(),
      ];
      return [
        `${branch.name}: tracking branch=${branch.upstream ?? "(not configured; independent of configured remotes and push status)"}`,
        ...(await Promise.all(
          pairs.map((ref) => compare(git, repo, branch, ref)),
        )),
        ...(matches.length
          ? []
          : [
              `${branch.name}: no same-name tracking ref observed${tracking === null || tracking.length > MAX_REFS ? " in partial/unavailable data" : ""}; server state is separate`,
            ]),
      ].join("\n");
    }),
  );
  const tagSummary =
    tags === null
      ? `Local tags: ${UNKNOWN}`
      : tags.length === 0
        ? "Local tags: none"
        : null;
  return [
    "These are LOCAL refs, including locally cached remote-tracking refs; they are not live server state. Tracking is branch configuration, not a remote named upstream.",
    `Relationships (first ${MAX_BRANCHES} local branches; omitted comparisons unknown):`,
    ...relations,
    `Local branches (${completeness(branches, MAX_REFS)}):`,
    (branches ?? []).slice(0, MAX_REFS).map(shortRef).join("\n") || "(none)",
    `Local remote-tracking refs (${completeness(tracking, MAX_REFS)}):`,
    (tracking ?? []).slice(0, MAX_REFS).map(shortRef).join("\n") || "(none)",
    ...(tagSummary ? [tagSummary] : []),
  ].join("\n\n");
}

async function historyEvidence(
  git: GitReader,
  repo: string,
  branches: Ref[] | null,
): Promise<ContextBlock[]> {
  const [head, shallow] = await Promise.all([
    git.read(repo, ["rev-parse", "--verify", "HEAD"]),
    git.read(repo, ["rev-parse", "--is-shallow-repository"]),
  ]);
  const targets = [
    ...new Map(
      [
        ...(head
          ? [
              {
                name: "HEAD",
                oid: head,
                type: "commit",
                upstream: null,
                symbolic: null,
              },
            ]
          : []),
        ...(branches ?? []).slice(0, MAX_BRANCHES),
      ].map((ref) => [ref.name, ref]),
    ).values(),
  ];
  const sections = await Promise.all(
    targets.map(async (ref) => {
      const [log, count, merges, reflog] = await Promise.all([
        git.read(repo, [
          "log",
          "-n",
          String(MAX_LOG),
          "--format=%H%x09%P%x09%s",
          ref.oid,
          "--",
        ]),
        git.read(repo, ["rev-list", "--count", ref.oid]),
        git.read(repo, ["rev-list", "--count", "--merges", ref.oid]),
        git.read(repo, [
          "reflog",
          "show",
          "-n",
          String(MAX_REFLOG),
          "--date=iso-strict",
          "--format=%H%x09%gD%x09%gs",
          ref.name,
        ]),
      ]);
      return {
        summary: `${ref.name} at ${ref.oid}: reachable commits=${count ?? "unknown"}, merge commits=${merges ?? "unknown"}`,
        log: `${ref.name}: newest first, at most ${MAX_LOG} (commit<TAB>parents<TAB>subject):\n${log ?? UNKNOWN}`,
        reflog: `${ref.name}: newest first, at most ${MAX_REFLOG} (commit<TAB>selector/time<TAB>event):\n${reflog || "unknown: reflog unavailable, empty, or expired; absence does not prove an action never happened"}`,
      };
    }),
  );
  const headRef = targets[0];
  const pairs = headRef
    ? await Promise.all(
        targets.slice(1).map((target) => compare(git, repo, headRef, target)),
      )
    : [];
  const scope = [
    `Shallow repository: ${shallow ?? "unknown"}. Counts/ancestry describe available objects only; shallow boundaries or missing objects limit conclusions.`,
    `History scope: HEAD and first ${MAX_BRANCHES} local branches. Omitted commits/events are unknown.`,
  ].join("\n\n");
  return [
    {
      id: "git-ancestry",
      label: "Branch ancestry and counts",
      text: [
        scope,
        ...sections.map((section) => section.summary),
        ...(pairs.length
          ? [
              "Reachability of HEAD relative to other inspected branches:",
              ...pairs,
            ]
          : []),
      ].join("\n\n"),
    },
    {
      id: "git-history",
      label: "Branch commit history",
      text: [scope, ...sections.map((section) => section.log)].join("\n\n"),
    },
    {
      id: "git-reflogs",
      label: "Branch operation history",
      text: [
        scope,
        "Reflogs omit author/email fields; clone/fetch/push destination text is redacted.",
        ...sections.map((section) =>
          section.reflog.replace(
            /\t(clone|fetch|pull|push)(?=[: ])[^\n]*/g,
            "\t$1: (destination/command omitted)",
          ),
        ),
      ].join("\n\n"),
    },
  ];
}

async function tagEvidence(
  git: GitReader,
  repo: string,
  tags: Ref[],
): Promise<string> {
  const records = await Promise.all(
    tags.slice(0, MAX_TAGS).map(async (tag) => {
      const annotated = tag.type === "tag";
      const peeled = await git.read(repo, [
        "rev-parse",
        "--verify",
        `${tag.oid}^{}`,
      ]);
      return JSON.stringify({
        ref: tag.name,
        kind: annotated ? "annotated" : "lightweight",
        objectType: tag.type,
        objectId: tag.oid,
        peeledTarget: peeled ?? "unknown",
      });
    }),
  );
  return `LOCAL tags: ${tags.length > MAX_TAGS ? `partial, first ${MAX_TAGS}; other tags unknown` : "complete"}. Kind and peeled target only; annotation bodies omitted.\n${records.join("\n")}\nAnnotated tag object IDs differ from their peeled targets; compare like fields with live remote tags.`;
}

type Target = { query: string; display: string };

/** Only normal Git transports, with file remotes contained in this exercise. */
function remoteTarget(raw: string, repo: string, root: string): Target | null {
  try {
    if (/^(https|ssh):\/\//i.test(raw)) {
      const url = new URL(raw);
      if (
        url.password ||
        (url.protocol === "https:" && url.username) ||
        url.search ||
        url.hash
      )
        return null;
      const display = new URL(url);
      display.username = "";
      return { query: url.toString(), display: display.toString() };
    }
    if (
      /^(?:[\w.-]+@)?[\w.-]+:[^/:].*/.test(raw) &&
      !path.isAbsolute(raw) &&
      !/^[a-z]:[\\/]/i.test(raw)
    ) {
      const colon = raw.indexOf(":");
      const host = raw.slice(0, colon);
      // Preserve SCP's home-relative path semantics; converting it to ssh://
      // would turn the path into an absolute path on a general SSH server.
      return {
        query: raw,
        display: `${host.split("@").pop()}:${raw.slice(colon + 1)}`,
      };
    }
    const local = realpath(
      raw.startsWith("file://") ? fileURLToPath(raw) : path.resolve(repo, raw),
    );
    if (!local || !contained(root, local)) return null;
    return {
      query: local,
      display: `exercise-relative:${path.relative(root, local) || "."}`,
    };
  } catch {
    return null;
  }
}

function remoteRefs(output: string): {
  heads: Map<string, string>;
  tags: Map<string, { objectId: string; peeledTarget?: string }>;
} {
  const heads = new Map<string, string>();
  const tags = new Map<string, { objectId: string; peeledTarget?: string }>();
  for (const line of output.split("\n")) {
    const [oid, ref] = line.split(/\s+/);
    if (!oid || !ref) continue;
    if (ref.startsWith("refs/heads/")) heads.set(ref, oid);
    if (ref.startsWith("refs/tags/")) {
      const name = ref.replace(/\^\{\}$/, "");
      const tag = tags.get(name) ?? { objectId: "" };
      if (name === ref) tag.objectId = oid;
      else tag.peeledTarget = oid;
      tags.set(name, tag);
    }
  }
  return { heads, tags };
}

async function remoteEvidence(
  git: GitReader,
  repo: string,
  root: string,
  branches: Ref[] | null,
  includeLiveTags: boolean,
): Promise<string | null> {
  const names = await git.read(repo, ["remote"]);
  if (names === null) return UNKNOWN;
  if (!names) return null;
  const configured = names.split("\n");
  const lsRemote = includeLiveTags
    ? (["ls-remote", "--heads", "--tags", "--"] as const)
    : (["ls-remote", "--heads", "--"] as const);
  const sections = await Promise.all(
    configured.slice(0, MAX_REMOTES).map(async (name) => {
      const destinations = await Promise.all(
        ["fetch", "push"].map(async (role) => {
          const urls = await git.read(repo, [
            "remote",
            "get-url",
            "--all",
            ...(role === "push" ? ["--push"] : []),
            name,
          ]);
          return {
            role,
            urls: urls === null ? null : urls.split("\n").filter(Boolean),
          };
        }),
      );
      const targets = new Map<string, { target: Target; roles: string[] }>();
      const unavailable: string[] = [];
      for (const { role, urls } of destinations) {
        if (!urls) unavailable.push(`${role}: destination unknown`);
        for (const raw of urls?.slice(0, MAX_TARGETS) ?? []) {
          const target = remoteTarget(raw, repo, root);
          if (!target) {
            unavailable.push(
              `${role}: unchecked destination (credentials, unsupported transport, or outside exercise boundary); refs unknown`,
            );
            continue;
          }
          const entry = targets.get(target.query) ?? { target, roles: [] };
          entry.roles.push(role);
          targets.set(target.query, entry);
        }
        if ((urls?.length ?? 0) > MAX_TARGETS)
          unavailable.push(
            `${role}: extra destinations unchecked; refs unknown`,
          );
      }
      const checked = await Promise.all(
        [...targets.values()]
          .slice(0, MAX_TARGETS)
          .map(async ({ target, roles }) => {
            const output = await git.read(
              repo,
              [...lsRemote, target.query],
              true,
            );
            const heading = `Remote ${name}, ${roles.join("+")} destination ${target.display}`;
            if (output === null)
              return `${heading}: live refs ${UNKNOWN} (including network/authentication failure)`;
            const { heads, tags } = remoteRefs(output);
            const relations = (branches ?? [])
              .slice(0, MAX_BRANCHES)
              .map((branch) => {
                const remote = heads.get(branch.name);
                return `${branch.name}: ${!remote ? "not advertised at this target" : remote === branch.oid ? "matches live remote tip" : `differs from live remote tip ${remote}; ancestry unknown without fetching`}`;
              });
            return [
              `${heading}: observed successfully at ${new Date().toISOString()}`,
              `Server heads (${heads.size > MAX_REFS ? `partial first ${MAX_REFS}` : "complete advertised list"}):`,
              ...[...heads]
                .slice(0, MAX_REFS)
                .map(([ref, objectId]) => JSON.stringify({ ref, objectId })),
              ...(includeLiveTags
                ? [
                    `Server tags (${tags.size > MAX_TAGS ? `partial first ${MAX_TAGS}` : "complete advertised list"}; peeled ^{} rows normalized):`,
                    ...[...tags]
                      .slice(0, MAX_TAGS)
                      .map(([ref, tag]) => JSON.stringify({ ref, ...tag })),
                  ]
                : []),
              ...relations,
            ].join("\n");
          }),
      );
      if (targets.size > MAX_TARGETS)
        unavailable.push("Extra targets unchecked; refs unknown.");
      return [`Remote ${name}:`, ...unavailable, ...checked].join("\n\n");
    }),
  );
  return [
    `LIVE remote observations via read-only ls-remote; no fetch/prune or local ref updates. At most ${MAX_REMOTES} remotes and ${MAX_TARGETS} destinations each. Unlisted/unchecked targets are unknown. Authentication is noninteractive; credential helpers are disabled.`,
    ...sections,
    ...(configured.length > MAX_REMOTES
      ? ["Additional configured remotes unchecked; refs unknown."]
      : []),
  ].join("\n\n");
}

export async function collectGitEvidence(
  git: GitReader,
  repo: string,
  root: string,
): Promise<ContextBlock[]> {
  const [branches, tracking, tags] = await Promise.all([
    refs(git, repo, "refs/heads"),
    refs(git, repo, "refs/remotes"),
    refs(git, repo, "refs/tags"),
  ]);
  const includeTagDetails = tags === null || tags.length > 0;
  const includeLiveTags = Boolean(tags?.length);
  const [branchText, history, tagText, remotes] = await Promise.all([
    branchEvidence(git, repo, branches, tracking, tags),
    historyEvidence(git, repo, branches),
    includeTagDetails && tags
      ? tagEvidence(git, repo, tags)
      : includeTagDetails
        ? Promise.resolve(UNKNOWN)
        : Promise.resolve(null),
    remoteEvidence(git, repo, root, branches, includeLiveTags),
  ]);
  return [
    { id: "git-refs", label: "Local branch relationships", text: branchText },
    ...history,
    ...(tagText
      ? [{ id: "git-tags", label: "Local tag details", text: tagText }]
      : []),
    ...(remotes
      ? [{ id: "git-remotes", label: "Live remote refs", text: remotes }]
      : []),
  ];
}
