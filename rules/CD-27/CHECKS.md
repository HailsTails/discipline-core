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
- Any method call with a computing or mutating name, on any receiver: `map`, `filter`, `reduce`, `find`, `forEach`, `join`, `slice`, `split`, `replace`, `includes`, `sort`, `trim`, `keys`, `values`, `push`, `pop`, `splice`, `fill` and similar string and array methods.
- Loops are not flagged here; CD-15 covers them. `throw` is CD-10.

Edition 2 also flags:
- `??`, `||` and `&&`, and their assignment forms `??=`, `||=` and `&&=`.
- Optional chaining: `a?.b`, `a?.[key]` and `f?.()`.
- `switch` statements.
- Computing calls on a built-in namespace: `JSON.stringify`, `JSON.parse`, `Object.assign`, `Object.fromEntries`, `Array.from` and any `Math` method.

Neither edition flags element access such as `calls[0]`, calls to free functions, or a method named by a computed key such as `rows["map"](f)`. Helper files that tests import are not checked; only the test files themselves are.

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

Under edition 2, write a fallback or an optional call as the value it gives:

```ts
const expected = given ?? 1;
```

```ts
expect(given).toBe(1);
```

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs logic. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs a `whyChain` as below. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-27#test-body-logic", "file": "src/legacy/report.test.ts", "reason": "..." }
] }
```

By default every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` or `file-carve-out` may give only its `reason`; a `clause-wide-carve-out` still needs its `whyChain`. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
