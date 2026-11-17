import type { Result } from "../core/values/result.ts";

export type LockedPackage = { readonly name: string; readonly version: string };

export type RequirementKind = "required" | "optional";

export type LockedRequirement = { readonly name: string; readonly kind: RequirementKind };

export type ClosureMember = LockedPackage & { readonly requires: readonly LockedRequirement[] };

type Reading<Value> = Result<Value, string>;

type LockLine = { readonly indent: number; readonly key: string; readonly value: string };

type LockNode = { readonly value: string; readonly children: ReadonlyMap<string, LockNode> };

type Siblings = { readonly entries: readonly (readonly [string, LockNode])[]; readonly next: number };

type Dependency = { readonly name: string; readonly version: string; readonly kind: RequirementKind };

type Member = { readonly name: string; readonly version: string; readonly requires: ReadonlyMap<string, RequirementKind> };

const SUPPORTED_LOCKFILE_VERSION = "9.0";

const QUOTED_LINE = /^'((?:[^']|'')*)'(?::\s*(.*))?$/;

const PLAIN_LINE = /^(.*?):(?:\s+(.*))?$/;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const LINE_BREAK = /\r?\n/;

const QUOTE = "'";

const DOUBLE_QUOTE = '"';

const ESCAPED_QUOTE = "''";

const PEER_SUFFIX_START = "(";

const NPM_ALIAS_PREFIX = "npm:";

const UNREADABLE_PREFIXES: readonly string[] = ["link:", "file:", "workspace:"];

const FLOW_STARTS: readonly string[] = ["{", "["];

const ROOT_IMPORTER = ".";

const EMPTY_FLOW_MAPPING = "{}";

const DEPENDENCY_SECTIONS: readonly (readonly [string, RequirementKind])[] = [
  ["dependencies", "required"],
  ["optionalDependencies", "optional"],
];

const failedReading = (request: { readonly error: string }): Reading<never> => ({ outcome: "failed", error: request.error });

const unquoted = (request: { readonly text: string }): string =>
  request.text.length > 1 && request.text.startsWith(QUOTE) && request.text.endsWith(QUOTE)
    ? request.text.slice(1, -1).replaceAll(ESCAPED_QUOTE, QUOTE)
    : request.text;

const lockLineOf = (request: { readonly raw: string }): LockLine => {
  const content = request.raw.trimStart();
  const indent = request.raw.length - content.length;
  const quoted = QUOTED_LINE.exec(content);
  if (quoted !== null) {
    return { indent, key: quoted[1].replaceAll(ESCAPED_QUOTE, QUOTE), value: unquoted({ text: quoted[2] ?? "" }) };
  }
  const plain = PLAIN_LINE.exec(content);
  return plain === null ? { indent, key: content, value: "" } : { indent, key: plain[1], value: unquoted({ text: plain[2] ?? "" }) };
};

const siblingsFrom = (request: {
  readonly lines: readonly LockLine[];
  readonly index: number;
  readonly indent: number;
  readonly found: Siblings["entries"];
}): Siblings => {
  const line = request.lines[request.index];
  if (line === undefined || line.indent < request.indent) {
    return { entries: request.found, next: request.index };
  }
  const following = request.lines[request.index + 1];
  const nested =
    following !== undefined && following.indent > line.indent
      ? siblingsFrom({ lines: request.lines, index: request.index + 1, indent: following.indent, found: [] })
      : { entries: [], next: request.index + 1 };
  return siblingsFrom({
    ...request,
    index: nested.next,
    found: [...request.found, [line.key, { value: line.value, children: new Map(nested.entries) }]],
  });
};

const lockTreeOf = (request: { readonly lockText: string }): Reading<ReadonlyMap<string, LockNode>> => {
  const raws = request.lockText.split(LINE_BREAK).filter((raw) => raw.trim() !== "");
  const doubleQuoted = raws.find((raw) => raw.trimStart().startsWith(DOUBLE_QUOTE));
  if (doubleQuoted !== undefined) {
    return failedReading({ error: `the lock holds a double-quoted key, which this reader does not read: ${doubleQuoted.trim()}` });
  }
  const lines = raws.map((raw) => lockLineOf({ raw }));
  return { outcome: "ok", value: new Map(siblingsFrom({ lines, index: 0, indent: 0, found: [] }).entries) };
};

const childOf = (request: { readonly node: LockNode | undefined; readonly key: string }): LockNode | undefined =>
  request.node?.children.get(request.key);

const withoutPeerSuffix = (request: { readonly version: string }): string => request.version.split(PEER_SUFFIX_START)[0];

const problemOfVersion = (request: { readonly value: string }): string | undefined => {
  const bare = withoutPeerSuffix({ version: request.value });
  if (request.value === "") {
    return "an empty version";
  }
  if (FLOW_STARTS.some((start) => request.value.startsWith(start))) {
    return "a flow value";
  }
  const unreadable = UNREADABLE_PREFIXES.find((prefix) => request.value.startsWith(prefix));
  if (unreadable !== undefined) {
    return `a ${unreadable} value`;
  }
  if (request.value.startsWith(NPM_ALIAS_PREFIX) || bare.includes("@")) {
    return "an alias";
  }
  return SEMVER.test(bare) ? undefined : "a version that is not semver";
};

const versionOf = (request: { readonly owner: string; readonly name: string; readonly value: string }): Reading<string> => {
  const problem = problemOfVersion({ value: request.value });
  if (problem === undefined) {
    return { outcome: "ok", value: request.value };
  }
  const shown = request.value === "" ? "" : `: ${request.value}`;
  return failedReading({ error: `${request.owner} holds ${problem} for ${request.name}${shown}` });
};

const allRead = <Value>(request: { readonly results: readonly Reading<Value>[] }): Reading<readonly Value[]> =>
  request.results.reduce<Reading<readonly Value[]>>(
    (sofar, next) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      return next.outcome === "failed" ? next : { outcome: "ok", value: [...sofar.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

const inlineValueOf = (request: { readonly node: LockNode | undefined }): string | undefined =>
  request.node === undefined || request.node.value === "" || request.node.value === EMPTY_FLOW_MAPPING ? undefined : request.node.value;

const sectionDependenciesOf = (request: {
  readonly owner: string;
  readonly section: string;
  readonly kind: RequirementKind;
  readonly node: LockNode | undefined;
}): Reading<readonly Dependency[]> => {
  const inline = inlineValueOf({ node: request.node });
  if (inline !== undefined) {
    return failedReading({ error: `${request.owner} holds an inline value for ${request.section}: ${inline}` });
  }
  return allRead({
    results: [...(request.node?.children ?? [])].map(([name, node]): Reading<Dependency> => {
      const version = versionOf({ owner: request.owner, name, value: node.value });
      return version.outcome === "failed" ? version : { outcome: "ok", value: { name, version: version.value, kind: request.kind } };
    }),
  });
};

const dependenciesOf = (request: { readonly owner: string; readonly holder: LockNode | undefined }): Reading<readonly Dependency[]> => {
  const sections = allRead({
    results: DEPENDENCY_SECTIONS.map(([section, kind]) =>
      sectionDependenciesOf({ owner: request.owner, section, kind, node: childOf({ node: request.holder, key: section }) }),
    ),
  });
  return sections.outcome === "failed" ? sections : { outcome: "ok", value: sections.value.flat() };
};

const identityOf = (request: { readonly name: string; readonly version: string }): string =>
  `${request.name}@${withoutPeerSuffix({ version: request.version })}`;

const mergedRequirements = (request: {
  readonly held: ReadonlyMap<string, RequirementKind>;
  readonly found: readonly Dependency[];
}): ReadonlyMap<string, RequirementKind> =>
  new Map([
    ...request.held,
    ...request.found.map((dependency): readonly [string, RequirementKind] => [
      dependency.name,
      request.held.get(dependency.name) === "required" ? "required" : dependency.kind,
    ]),
  ]);

const closureOf = (request: {
  readonly pending: readonly Dependency[];
  readonly expanded: ReadonlySet<string>;
  readonly members: ReadonlyMap<string, Member>;
  readonly snapshots: LockNode;
}): Reading<ReadonlyMap<string, Member>> => {
  const [next, ...rest] = request.pending;
  if (next === undefined) {
    return { outcome: "ok", value: request.members };
  }
  const key = `${next.name}@${next.version}`;
  if (request.expanded.has(key)) {
    return closureOf({ ...request, pending: rest });
  }
  const snapshot = childOf({ node: request.snapshots, key });
  if (snapshot === undefined) {
    return failedReading({ error: `the lock holds no snapshot for ${key}` });
  }
  const inlineSnapshot = inlineValueOf({ node: snapshot });
  if (inlineSnapshot !== undefined) {
    return failedReading({ error: `the lock holds an inline value for ${key}: ${inlineSnapshot}` });
  }
  const found = dependenciesOf({ owner: key, holder: snapshot });
  if (found.outcome === "failed") {
    return found;
  }
  const identity = identityOf(next);
  const held = request.members.get(identity)?.requires ?? new Map<string, RequirementKind>();
  return closureOf({
    pending: [...rest, ...found.value],
    expanded: new Set([...request.expanded, key]),
    members: new Map([
      ...request.members,
      [
        identity,
        {
          name: next.name,
          version: withoutPeerSuffix({ version: next.version }),
          requires: mergedRequirements({ held, found: found.value }),
        },
      ],
    ]),
    snapshots: request.snapshots,
  });
};

const conflictOf = (request: { readonly members: readonly Member[] }): string | undefined =>
  request.members.find((member) => request.members.some((other) => other.name === member.name && other.version !== member.version))?.name;

const closureMemberOf = (request: { readonly member: Member }): ClosureMember => ({
  name: request.member.name,
  version: request.member.version,
  requires: [...request.member.requires].map(([name, kind]) => ({ name, kind })),
});

const sectionOf = (request: {
  readonly tree: ReadonlyMap<string, LockNode>;
  readonly key: string;
}): Reading<LockNode> => {
  const section = request.tree.get(request.key);
  return section === undefined ? failedReading({ error: `the lock holds no ${request.key} section` }) : { outcome: "ok", value: section };
};

const rootDependenciesOf = (request: {
  readonly importers: LockNode;
  readonly dependencies: readonly string[];
}): Reading<readonly Dependency[]> => {
  const importer = childOf({ node: request.importers, key: ROOT_IMPORTER });
  if (importer === undefined) {
    return failedReading({ error: "the lock holds no importer for the repository root" });
  }
  const direct = childOf({ node: importer, key: "dependencies" });
  const unheld = request.dependencies.find((name) => direct?.children.get(name) === undefined);
  if (unheld !== undefined) {
    return failedReading({ error: `core depends on ${unheld}, which the lock does not hold` });
  }
  return allRead({
    results: request.dependencies.map((name): Reading<Dependency> => {
      const version = versionOf({
        owner: "the root importer",
        name,
        value: childOf({ node: direct?.children.get(name), key: "version" })?.value ?? "",
      });
      return version.outcome === "failed" ? version : { outcome: "ok", value: { name, version: version.value, kind: "required" } };
    }),
  });
};

export const productionClosureOf = (request: {
  readonly lockText: string;
  readonly dependencies: readonly string[];
}): Reading<readonly ClosureMember[]> => {
  const tree = lockTreeOf({ lockText: request.lockText });
  if (tree.outcome === "failed") {
    return tree;
  }
  const lockfileVersion = tree.value.get("lockfileVersion")?.value;
  if (lockfileVersion !== SUPPORTED_LOCKFILE_VERSION) {
    return failedReading({
      error: `the lock's lockfileVersion is ${lockfileVersion ?? "missing"}, which is not the supported ${SUPPORTED_LOCKFILE_VERSION}`,
    });
  }
  const importers = sectionOf({ tree: tree.value, key: "importers" });
  if (importers.outcome === "failed") {
    return importers;
  }
  const snapshots = sectionOf({ tree: tree.value, key: "snapshots" });
  if (snapshots.outcome === "failed") {
    return snapshots;
  }
  const direct = rootDependenciesOf({ importers: importers.value, dependencies: request.dependencies });
  if (direct.outcome === "failed") {
    return direct;
  }
  const closure = closureOf({ pending: direct.value, expanded: new Set(), members: new Map(), snapshots: snapshots.value });
  if (closure.outcome === "failed") {
    return closure;
  }
  const members = [...closure.value.values()];
  const conflict = conflictOf({ members });
  return conflict === undefined
    ? { outcome: "ok", value: members.map((member) => closureMemberOf({ member })) }
    : failedReading({ error: `core's dependencies in the lock hold ${conflict} at more than one version, which a flat stage cannot place` });
};
