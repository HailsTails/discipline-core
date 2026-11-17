import type { Result } from "../core/values/result.ts";

export type LockedPackage = { readonly name: string; readonly version: string };

type LockLine = { readonly indent: number; readonly key: string; readonly value: string };

type LockNode = { readonly value: string; readonly children: ReadonlyMap<string, LockNode> };

type Siblings = { readonly entries: readonly (readonly [string, LockNode])[]; readonly next: number };

const QUOTED_LINE = /^'((?:[^']|'')*)'(?::\s*(.*))?$/;

const PLAIN_LINE = /^(.*?):(?:\s+(.*))?$/;

const QUOTE = "'";

const ESCAPED_QUOTE = "''";

const PEER_SUFFIX_START = "(";

const IMPORTER_FOLDER = ".";

const VIRTUAL_STORE_FOLDER = ".pnpm";

const SLASH = "/";

const SLASH_IN_FOLDER = "+";

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

const lockTreeOf = (request: { readonly lockText: string }): ReadonlyMap<string, LockNode> => {
  const lines = request.lockText
    .split(/\r?\n/)
    .filter((raw) => raw.trim() !== "")
    .map((raw) => lockLineOf({ raw }));
  return new Map(siblingsFrom({ lines, index: 0, indent: 0, found: [] }).entries);
};

const childOf = (request: { readonly node: LockNode | undefined; readonly key: string }): LockNode | undefined =>
  request.node?.children.get(request.key);

const withoutPeerSuffix = (request: { readonly version: string }): string =>
  request.version.split(PEER_SUFFIX_START)[0];

const lockedPackageOf = (request: { readonly name: string; readonly version: string }): LockedPackage => ({
  name: request.name,
  version: withoutPeerSuffix({ version: request.version }),
});

const keyOf = (request: { readonly name: string; readonly version: string }): string => `${request.name}@${request.version}`;

const dependencyVersionsOf = (request: { readonly snapshot: LockNode | undefined }): readonly (readonly [string, string])[] =>
  ["dependencies", "optionalDependencies"].flatMap((section) =>
    [...(childOf({ node: request.snapshot, key: section })?.children ?? [])].map(([name, node]): readonly [string, string] => [
      name,
      node.value,
    ]),
  );

const closureOf = (request: {
  readonly pending: readonly (readonly [string, string])[];
  readonly reached: ReadonlySet<string>;
  readonly snapshots: LockNode | undefined;
}): ReadonlySet<string> => {
  const [next, ...rest] = request.pending;
  if (next === undefined) {
    return request.reached;
  }
  const key = keyOf({ name: next[0], version: next[1] });
  return request.reached.has(key)
    ? closureOf({ ...request, pending: rest })
    : closureOf({
        pending: [...rest, ...dependencyVersionsOf({ snapshot: childOf({ node: request.snapshots, key }) })],
        reached: new Set([...request.reached, key]),
        snapshots: request.snapshots,
      });
};

const lockedPackageOfKey = (request: { readonly key: string }): LockedPackage => {
  const separator = request.key.indexOf("@", 1);
  return lockedPackageOf({ name: request.key.slice(0, separator), version: request.key.slice(separator + 1) });
};

const conflictsOf = (request: { readonly closure: readonly LockedPackage[] }): readonly string[] =>
  request.closure.flatMap((locked) =>
    request.closure.some((other) => other.name === locked.name && other.version !== locked.version)
      ? [`${locked.name} at more than one version`]
      : [],
  );

export const productionClosureOf = (request: {
  readonly lockText: string;
  readonly dependencies: readonly string[];
}): Result<readonly LockedPackage[], string> => {
  const tree = lockTreeOf({ lockText: request.lockText });
  const direct = childOf({ node: childOf({ node: tree.get("importers"), key: IMPORTER_FOLDER }), key: "dependencies" });
  const unheld = request.dependencies.find((name) => direct?.children.get(name) === undefined);
  if (unheld !== undefined) {
    return { outcome: "failed", error: `core depends on ${unheld}, which the lock does not hold` };
  }
  const closure = [
    ...closureOf({
      pending: request.dependencies.map((name): readonly [string, string] => [
        name,
        childOf({ node: direct?.children.get(name), key: "version" })?.value ?? "",
      ]),
      reached: new Set(),
      snapshots: tree.get("snapshots"),
    }),
  ].map((key) => lockedPackageOfKey({ key }));
  const conflicts = conflictsOf({ closure });
  return conflicts.length === 0
    ? { outcome: "ok", value: closure }
    : { outcome: "failed", error: `core's dependencies in the lock hold ${[...new Set(conflicts)].join(", ")}, which a flat stage cannot place` };
};

export const installedPackageFolderOf = (request: { readonly dependencies: string; readonly locked: LockedPackage }): readonly string[] => [
  request.dependencies,
  VIRTUAL_STORE_FOLDER,
  `${request.locked.name.replaceAll(SLASH, SLASH_IN_FOLDER)}@${request.locked.version}`,
  "node_modules",
  ...request.locked.name.split(SLASH),
];
