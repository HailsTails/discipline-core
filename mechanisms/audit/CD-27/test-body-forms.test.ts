import { assert, describe, expect, it } from "vitest";
import { defaultParsePort } from "../../../tests/typescript-parse-port.ts";
import type { SyntaxNode } from "../runner/typescript-parse.ts";
import { syntaxNodeOf } from "../../../tests/syntax-node-of.ts";
import { TEST_BODY_SECTIONS, testBodyFormOf } from "./test-body-logic.ts";

const SYNTAX_API = defaultParsePort.syntaxApi;

const firstStatementOf = (request: { readonly source: string }): SyntaxNode =>
  SYNTAX_API.createSourceFile("form.test.ts", request.source, SYNTAX_API.ScriptTarget.Latest, true)
    .getChildAt(0)
    .getChildAt(0);

const firstExpressionOf = (request: { readonly source: string }): SyntaxNode =>
  firstStatementOf(request).getChildAt(0);

const STATEMENT_FORMS = [
  { name: "an if statement", source: "if (ok) {}", edition: "1", section: "branching-with-if" },
  { name: "a try statement", source: "try {} catch {}", edition: "1", section: "a-try-block" },
  { name: "a let statement", source: "let total = 1;", edition: "1", section: "a-let" },
  { name: "a switch statement", source: "switch (kind) {}", edition: "2", section: "a-switch" },
];

const EXPRESSION_FORMS = [
  { name: "a ternary", source: "ok ? 1 : 2;", edition: "1", section: "a-ternary" },
  { name: "find", source: "rows.find(isFirst);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "at", source: "rows.at(0);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "includes", source: "rows.includes(row);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "map", source: "rows.map(idOf);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "join", source: "parts.join(\",\");", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "push", source: "rows.push(row);", edition: "1", section: "a-method-that-mutates" },
  { name: "fill", source: "rows.fill(0);", edition: "1", section: "a-method-that-mutates" },
  { name: "a nullish fallback", source: "given ?? 1;", edition: "2", section: "a-short-circuit" },
  { name: "a logical and", source: "left && right;", edition: "2", section: "a-short-circuit" },
  { name: "a logical or assignment", source: "given ||= 1;", edition: "2", section: "a-short-circuit" },
  { name: "an optional property after an index", source: "tasks[0]?.id;", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional element after an index", source: "rows[0]?.[1];", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional chain on a mock call", source: "run.mock.calls[0]?.[0];", edition: "2", section: "an-optional-chain-on-a-mock-call" },
  { name: "an optional chain on a mock result", source: "run.mock.results[0]?.value;", edition: "2", section: "an-optional-chain-on-a-mock-call" },
  { name: "an optional chain on a mock's last call", source: "run.mock.lastCall?.[0];", edition: "2", section: "an-optional-chain-on-a-mock-call" },
  { name: "an optional property", source: "result.value?.name;", edition: "2", section: "an-optional-chain-on-a-property" },
  { name: "an optional call", source: "observers.enter?.();", edition: "2", section: "an-optional-call" },
  { name: "an optional call of a computing method", source: "rows.map?.(idOf);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "Object.keys", source: "Object.keys(value);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "JSON.stringify", source: "JSON.stringify(value);", edition: "2", section: "serialising-json" },
  { name: "JSON.parse", source: "JSON.parse(text);", edition: "2", section: "parsing-json" },
  { name: "Object.assign", source: "Object.assign(target, source);", edition: "2", section: "merging-objects" },
  { name: "Object.fromEntries", source: "Object.fromEntries(pairs);", edition: "2", section: "building-an-object-from-entries" },
  { name: "Array.from", source: "Array.from({ length: 3 });", edition: "2", section: "building-an-array-from-a-length" },
  { name: "a Math method", source: "Math.max(a, b);", edition: "2", section: "a-math-call" },
];

const PLAIN_EXPRESSIONS = [
  { name: "element access", source: "rows[0];" },
  { name: "a free call", source: "build(rows);" },
  { name: "a computed method call", source: "rows[\"map\"](idOf);" },
  { name: "an assert.isDefined call", source: "assert.isDefined(first);" },
  { name: "a toMatchObject call", source: "expect(first).toMatchObject({ id: \"a\" });" },
  { name: "an unlisted JSON method", source: "JSON.rawJSON(text);" },
  { name: "an unlisted Object method", source: "Object.freeze(value);" },
];

describe("testBodyFormOf", () => {
  it.each(STATEMENT_FORMS)("names $name as introduced in edition $edition with the $section fix", ({ source, edition, section }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstStatementOf({ source }) })).toMatchObject({
      introducedIn: edition,
      remedy: { section },
    });
  });

  it.each(EXPRESSION_FORMS)("names $name as introduced in edition $edition with the $section fix", ({ source, edition, section }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toMatchObject({
      introducedIn: edition,
      remedy: { section },
    });
  });

  it.each(PLAIN_EXPRESSIONS)("names no form for $name", ({ source }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toBeUndefined();
  });

  it("names no form for a const statement", () => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstStatementOf({ source: "const total = 1;" }) })).toBeUndefined();
  });

  it("names the replacement for an optional chain after an index in its fix", () => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source: "tasks[0]?.id;" }) })).toEqual({
      introducedIn: "2",
      remedy: {
        fix: "compare the whole element with toMatchObject, or destructure it and assert.isDefined it before reading it",
        section: "an-optional-chain-after-an-index",
      },
    });
  });
});

describe("TEST_BODY_SECTIONS", () => {
  it("lists each CHECKS.md section a finding can name, once, in page order", () => {
    expect(TEST_BODY_SECTIONS).toEqual([
      "branching-with-if",
      "a-try-block",
      "a-ternary",
      "a-let",
      "a-method-that-picks-or-tests-an-element",
      "a-method-that-computes-a-value",
      "a-method-that-mutates",
      "a-short-circuit",
      "an-optional-chain-after-an-index",
      "an-optional-chain-on-a-mock-call",
      "an-optional-chain-on-a-property",
      "an-optional-call",
      "a-switch",
      "serialising-json",
      "parsing-json",
      "merging-objects",
      "building-an-object-from-entries",
      "building-an-array-from-a-length",
      "a-math-call",
      "logic-inside-a-hand-written-double",
    ]);
  });
});

const CALL = SYNTAX_API.SyntaxKind.CallExpression;

const DOUBLE_SITES = [
  { name: "an arrow property", source: "const port = { isFile: (path) => files.includes(path) };", text: "files.includes", kind: CALL, edition: "1" },
  { name: "a method", source: "const port = { isFile(path) { return files.includes(path); } };", text: "files.includes", kind: CALL, edition: "1" },
  { name: "a function expression property", source: "const port = { read: function () { return given ?? \"\"; } };", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a double passed inline", source: "run({ fileKind: { isFile: (path) => path.endsWith(\".ts\") } });", text: "path.endsWith", kind: CALL, edition: "1" },
  { name: "a branch inside a method", source: "const port = { read(path) { if (path) {} } };", text: "if (path)", kind: SYNTAX_API.SyntaxKind.IfStatement, edition: "1" },
];

const OUTSIDE_DOUBLE_SITES = [
  { name: "a test callback", source: "it(\"reads\", () => { rows.map(idOf); });", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "a const arrow", source: "const idsOf = () => rows.map(idOf);", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "an object literal value that is not a function", source: "const row = { ids: rows.map(idOf) };", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "a callback inside a double's method", source: "const port = { all: () => run(() => rows.map(idOf)) };", text: "rows.map", section: "a-method-that-computes-a-value" },
];

describe("testBodyFormOf inside a hand-written double", () => {
  it.each(DOUBLE_SITES)("names the fake fix, at the construct's own edition, for logic in $name", ({ source, text, kind, edition }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toEqual({
      introducedIn: edition,
      remedy: {
        fix: "a double with behaviour is a fake: write it once as an in-memory implementation of the port, in its own module with its own tests, as CD-25 says",
        section: "logic-inside-a-hand-written-double",
      },
    });
  });

  it.each(OUTSIDE_DOUBLE_SITES)("names the construct's own fix for logic in $name", ({ source, text, section }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({
      remedy: { section },
    });
  });
});

const RELEASED_OWN_API_CALLS = [
  { name: "a port method given an object", source: "paths.join({ segments: [\"a\", \"b\"] });", text: "paths.join" },
  { name: "a repository lookup given an object", source: "repository.find({ id: \"a\" });", text: "repository.find" },
  { name: "a query given an object", source: "store.filter({ status: \"open\" });", text: "store.filter" },
  { name: "a method given more arguments than any built-in of its name takes", source: "screen.keys(\"x\", true, true);", text: "screen.keys" },
  { name: "an entries method given an argument", source: "scenario.entries(output);", text: "scenario.entries" },
  { name: "a port imported from a relative module", source: "import { paths } from \"./paths.ts\";\npaths.join({ segments: [\"a\"] });", text: "paths.join" },
];

const FLAGGED_LOOK_ALIKES = [
  { name: "includes given an object", source: "rows.includes({ id: \"a\" });", text: "rows.includes" },
  { name: "indexOf given an object", source: "rows.indexOf({ id: \"a\" });", text: "rows.indexOf" },
  { name: "push given an object", source: "rows.push({ id: \"a\" });", text: "rows.push" },
  { name: "concat given objects", source: "rows.concat({ id: \"a\" }, { id: \"b\" });", text: "rows.concat" },
  { name: "reduce given an object to start from", source: "rows.reduce(sum, { total: 0 });", text: "rows.reduce" },
  { name: "with given an object", source: "rows.with(0, { id: \"a\" });", text: "rows.with" },
  { name: "splice given an object to insert", source: "rows.splice(0, 1, { id: \"a\" });", text: "rows.splice" },
  { name: "fill given an object", source: "rows.fill({ id: \"a\" });", text: "rows.fill" },
  { name: "a Buffer search with an encoding", source: "buffer.includes(\"x\", 0, \"utf8\");", text: "buffer.includes" },
  { name: "Object.entries given an object", source: "Object.entries({ a: 1 });", text: "Object.entries" },
  { name: "Object.keys given a value", source: "Object.keys(value);", text: "Object.keys" },
  { name: "join on node:path", source: "import path from \"node:path\";\npath.join(\"a\", \"b\", \"c\");", text: "path.join" },
  { name: "join on a namespace import of path", source: "import * as path from \"path\";\npath.join(\"a\", \"b\", \"c\");", text: "path.join" },
  { name: "join on a named import from node:path", source: "import { posix } from \"node:path\";\nposix.join(\"a\", \"b\", \"c\");", text: "posix.join" },
  { name: "join on a member of node:path", source: "import path from \"node:path\";\npath.posix.join(\"a\", \"b\", \"c\");", text: "path.posix.join" },
  { name: "a library helper given an object", source: "import _ from \"lodash\";\n_.find(rows, { id: \"a\" }, 0, 1);", text: "_.find" },
  { name: "a string literal split by an object", source: "\"a,b\".split({ separator: \",\" });", text: "\"a,b\".split" },
  { name: "a port method given a variable", source: "paths.join(request);", text: "paths.join" },
  { name: "a call that spreads its arguments", source: "screen.keys(...presses);", text: "screen.keys" },
  { name: "a callback method given a callback", source: "rows.find((row) => row.id === \"a\");", text: "rows.find" },
];

describe("testBodyFormOf on a listed method name that is the adopter's own API", () => {
  it.each(RELEASED_OWN_API_CALLS)("names no form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toBeUndefined();
  });

  it.each(FLAGGED_LOOK_ALIKES)("still names a first-edition form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({ introducedIn: "1" });
  });
});
