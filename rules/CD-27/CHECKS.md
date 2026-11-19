# CD-27 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-27#test-body-logic` | audit | branching, `let`, and computing methods in a test file; edition 2 adds short-circuits, optional chaining, `switch` and computing namespace calls |
| `CD-27#focused-tests` | eslint | `.only` on a test or suite, or `fdescribe`, `fit`, `ftest`, `fsuite` |
| `CD-27#skipped-tests` | eslint | `.skip` or `.fixme` on a test or suite, or `xdescribe`, `xit`, `xtest`, `xsuite` |

## What the check flags
`CD-27#test-body-logic` has two editions. Edition 1 runs by default. Edition 2 adds the constructs below and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `if` statements, `try` statements, ternary expressions and `let` declarations.
- A method call with a computing or mutating name, wherever it could be the string or array method of that name: `map`, `filter`, `reduce`, `find`, `forEach`, `join`, `slice`, `split`, `replace`, `includes`, `sort`, `trim`, `keys`, `values`, `push`, `pop`, `splice`, `fill` and similar string and array methods.
- Not flagged: a call with one of those names that no string or array method could be, which is the unit's own API. It passes an object literal where no string or array method of that name takes one, such as `paths.join({ segments: ["a", "b"] })` or `repository.find({ id: "a" })`, or more arguments than any of them takes, such as `screen.keys("x", true, true)`.
- Still flagged, though they look like that: a call on `Object`, `Array`, `JSON`, `Math` or another built-in namespace, such as `Object.entries({ a: 1 })`; a call on anything imported from a package or a `node:` module, such as `path.join("a", "b", "c")`; a call on a string or array literal; a call that spreads its arguments; a call given a variable, such as `paths.join(request)`; and a method that takes any value given an object, such as `rows.includes({ id: "a" })`, `rows.push({ id: "a" })` or `rows.reduce(sum, { total: 0 })`.
- Loops are not flagged here; CD-15 covers them. `throw` is CD-10.

Edition 2 also flags:
- `??`, `||` and `&&`, and their assignment forms `??=`, `||=` and `&&=`.
- Optional chaining: `a?.b`, `a?.[key]` and `f?.()`.
- `switch` statements.
- Computing calls on a built-in namespace: `JSON.stringify`, `JSON.parse`, `Object.assign`, `Object.fromEntries`, `Array.from` and any `Math` method.

Neither edition flags element access such as `calls[0]`, calls to free functions, or a method called through a computed key, such as `rows["map"]`. Helper files that tests import are not checked; only the test files themselves are.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-27/README.md).
- `hone-cd27/focused-tests` flags `.only` on a `describe`, `it`, `test` or `suite` chain, including `.only.each` and `test.describe.only`, and the bare names `fdescribe`, `fit`, `ftest` and `fsuite`. It reports at the `only` token.
- `hone-cd27/skipped-tests` flags `.skip` and `.fixme` on those chains, and the bare names `xdescribe`, `xit`, `xtest` and `xsuite`.
- Not flagged: `.todo`, `.concurrent` and `.each`.

## Settings
- `edition`: the edition this clause runs, `"1"` or `"2"`. Without it, the clause runs edition 1, or the latest edition when `checkEditions` in `disciplines.json` is `"latest"`.

```json
"clauseSettings": {
  "CD-27#test-body-logic": { "edition": "2" }
}
```

## Example violation
```ts
const expected = rows.map((row) => row.id);
```

## How to fix
```ts
expect(ids).toEqual(["a1", "b2"]);
```
Write the expected value out. A method call in the act step is flagged too, so move such logic into the unit under test.

Each finding ends with `fix:` and the section below that shows the allowed form for what it flagged, such as `(CHECKS.md#an-optional-chain-after-an-index)`.

## Allowed forms in a test
Each section shows a flagged form first, then the forms to write instead. Every form to write instead passes each clause Hone ships that reaches a test file, which are CD-1, CD-2, CD-14, CD-15 and both editions of this clause, and compiles under the compiler options CD-3 requires. A test reads this page and holds every block on it to that. `assert`, `expect`, `it` and `vi` come from `vitest`, and a `declare const` line stands for the unit under test.

### Branching with if
```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
const parsed = parse("a");
if (parsed.outcome === "ok") {
  expect(parsed.value).toBe("a");
}
```
Compare the whole result:

```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
expect(parse("a")).toEqual({ outcome: "ok", value: "a" });
```

Or write one test per case, or one table:

```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
it.each([
  { text: "a", expected: { outcome: "ok", value: "a" } },
  { text: "", expected: { outcome: "failed" } },
])("parses $text", ({ text, expected }) => {
  expect(parse(text)).toEqual(expected);
});
```

### A try block
```ts
declare const load: (path: string) => string;
try {
  load("missing.json");
} catch (error) {
  expect(error).toBeInstanceOf(Error);
}
```
Assert the throw:

```ts
declare const load: (path: string) => string;
expect(() => load("missing.json")).toThrow(Error);
```

```ts
declare const loadLater: (path: string) => Promise<string>;
it("refuses a missing file", async () => {
  await expect(loadLater("missing.json")).rejects.toThrow(Error);
});
```

### A ternary
```ts
declare const discountFor: (customer: { readonly premium: boolean }) => number;
const premium = true;
expect(discountFor({ premium })).toBe(premium ? 10 : 0);
```
Write the value out, with one table row per case:

```ts
declare const discountFor: (customer: { readonly premium: boolean }) => number;
it.each([
  { premium: true, expected: 10 },
  { premium: false, expected: 0 },
])("gives $expected off when premium is $premium", ({ premium, expected }) => {
  expect(discountFor({ premium })).toBe(expected);
});
```

### A let
```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
let saved = "";
record({ save: (text) => { saved = text; } });
expect(saved).toBe("a");
```
Record the calls with `vi.fn` and assert them:

```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
const save = vi.fn<(text: string) => void>();
record({ save });
expect(save).toHaveBeenCalledWith("a");
```

### A method that picks or tests an element
```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
expect(listTasks().find((task) => task.id === "a")).toEqual({ id: "a", done: false });
```
Assert on the whole array:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
expect(listTasks()).toContainEqual({ id: "a", done: false });
```

```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
expect(listTasks()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "a" })]));
```

The unit's own method with one of these names is not flagged when it is given an object, such as `repository.find({ id: "a" })`. Given a variable, such as `repository.find(query)`, it is still flagged, and no form in a test file avoids that finding.

### A method that computes a value
```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
const rows = [{ id: "a1" }, { id: "b2" }];
expect(idsOf(rows)).toEqual(rows.map((row) => row.id));
```
Write the expected value out:

```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
expect(idsOf([{ id: "a1" }, { id: "b2" }])).toEqual(["a1", "b2"]);
```

Or match the part that matters:

```ts
declare const receiptOf: (order: { readonly total: number }) => { readonly total: number; readonly label: string };
expect(receiptOf({ total: 30 })).toMatchObject({ label: expect.stringContaining("30") });
```

### A method that mutates
```ts
declare const namesOf: (team: string) => readonly string[];
const expected = ["Ada"];
expected.push("Grace");
expect(namesOf("core")).toEqual(expected);
```
Write the finished array out:

```ts
declare const namesOf: (team: string) => readonly string[];
expect(namesOf("core")).toEqual(["Ada", "Grace"]);
```

### A short-circuit
```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
expect(found !== undefined && found.name === "Ada").toBe(true);
```
Write the value a fallback gives. To narrow a value that may be missing, assert it is defined, then read it:

```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
assert.isDefined(found);
expect(found.name).toBe("Ada");
```

### An optional chain after an index
```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
expect(listTasks()[0]?.id).toBe("a");
```
Compare the whole element:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
expect(listTasks()[0]).toMatchObject({ id: "a" });
```

Or destructure it and assert it is defined before reading it:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly done: boolean }[];
const [first] = listTasks();
assert.isDefined(first);
expect(first.id).toBe("a");
```

### An optional chain on a mock call
```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run.mock.calls[0]?.[0].id).toBe("a");
```
Assert the call:

```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run).toHaveBeenCalledWith({ id: "a" });
```

```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "a" }));
```

### An optional chain on a property
```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
expect(findUser("a")?.name).toBe("Ada");
```
Compare the whole value:

```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
expect(findUser("a")).toMatchObject({ name: "Ada" });
```

Or assert it is defined before reading it:

```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
const user = findUser("a");
assert.isDefined(user);
expect(user.name).toBe("Ada");
```

### An optional call
```ts
declare const observers: { readonly enter?: (node: string) => void };
observers.enter?.("a");
```
Destructure the function, assert it is defined, then call it:

```ts
declare const observers: { readonly enter?: (node: string) => void };
const { enter } = observers;
assert.isDefined(enter);
enter("a");
```

### A switch
```ts
declare const areaOf: (shape: { readonly kind: "square"; readonly side: number } | { readonly kind: "circle"; readonly radius: number }) => number;
const shape = { kind: "square", side: 2 } as const;
switch (shape.kind) {
  case "square":
    expect(areaOf(shape)).toBe(4);
}
```
Write one test per case, or one table:

```ts
declare const areaOf: (shape: { readonly kind: "square"; readonly side: number } | { readonly kind: "circle"; readonly radius: number }) => number;
it.each([
  { shape: { kind: "square", side: 2 } as const, expected: 4 },
  { shape: { kind: "circle", radius: 0 } as const, expected: 0 },
])("measures a $shape.kind", ({ shape, expected }) => {
  expect(areaOf(shape)).toBe(expected);
});
```

### Serialising JSON
```ts
declare const handle: (body: string) => number;
expect(handle(JSON.stringify({ id: "a" }))).toBe(201);
```
Write the JSON text out:

```ts
declare const handle: (body: string) => number;
expect(handle('{"id":"a"}')).toBe(201);
```

### Parsing JSON
```ts
declare const render: (row: { readonly id: string }) => string;
expect(JSON.parse(render({ id: "a" }))).toEqual({ id: "a" });
```
Compare the raw text:

```ts
declare const render: (row: { readonly id: string }) => string;
expect(render({ id: "a" })).toBe('{"id":"a"}');
```

Or read it back through the unit's own decoder:

```ts
declare const render: (row: { readonly id: string }) => string;
declare const decode: (text: string) => { readonly id: string };
expect(decode(render({ id: "a" }))).toEqual({ id: "a" });
```

Reading text back as a structure, so that the order of its keys does not matter, has no form in a test file: `JSON.parse` is flagged there, and a unit with no decoder of its own has nothing else to read it with.

### Merging objects
```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = Object.assign({}, base, { body: "a" });
expect(request.body).toBe("a");
```
Write the object out, spreading what it copies:

```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = { ...base, body: "a" };
expect(request.body).toBe("a");
```

A Node error with a `code`, as `Object.assign(new Error("ENOENT"), { code: "ENOENT" })` builds it, has no form in a test file: a class is CD-14, a cast is CD-2, and an object literal is not an `Error`.

### Building an object from entries
```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual(Object.fromEntries([["a", 1]]));
```
Write the object out:

```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual({ a: 1 });
```

### Building an array from a length
```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf(Array.from({ length: 3 }, (_, index) => ({ id: index })))).toHaveLength(3);
```
Write the array out:

```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf([{ id: 0 }, { id: 1 }, { id: 2 }])).toHaveLength(3);
```

An array too long to write out, such as one row past a page size of 1,000, has no form in a test file: a loop is CD-15, and `Array.from` and the array methods are flagged here.

### A Math call
```ts
declare const roundedOf: (value: number) => number;
expect(roundedOf(2.5)).toBe(Math.round(2.5));
```
Write the number out:

```ts
declare const roundedOf: (value: number) => number;
expect(roundedOf(2.5)).toBe(3);
```

### Logic inside a hand-written double
```ts
declare const isInstalled: (fileKind: { readonly isFile: (path: string) => boolean }) => boolean;
const installedFiles = ["bin/hone.js"];
expect(isInstalled({ isFile: (path) => installedFiles.includes(path) })).toBe(true);
```
A function written as a property or method of an object literal in a test file is read as a hand-written double, so any flagged construct inside it names this section. A double whose answer depends on its input is a fake, and [CD-25](../CD-25/CHECKS.md) says where a fake lives: written once as an in-memory implementation of the port, in its own module with its own tests, and passed in. Here `declare const inMemoryFileKind` stands for that module:

```ts
declare const isInstalled: (fileKind: { readonly isFile: (path: string) => boolean }) => boolean;
declare const inMemoryFileKind: (files: readonly string[]) => { readonly isFile: (path: string) => boolean };
expect(isInstalled(inMemoryFileKind(["bin/hone.js"]))).toBe(true);
```

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs logic. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-27#test-body-logic", "file": "src/legacy/report.test.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
