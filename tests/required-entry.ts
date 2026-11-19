import { assert } from "vitest";

export const requiredEntry = <Entry>(request: {
  readonly table: Readonly<Record<string, Entry>>;
  readonly key: string;
}): Entry => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

export const requiredSegmentsEntry = <Entry>(request: {
  readonly table: Readonly<Record<string, Entry>>;
  readonly segments: readonly string[];
}): Entry => requiredEntry({ table: request.table, key: JSON.stringify(request.segments) });
