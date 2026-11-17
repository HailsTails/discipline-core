# CD-2: Closed enumerated list of permitted cast sites

## Rule

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it, each one an exception record for the file at that boundary. Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-2#cast-expressions` | audit | a type assertion that is not on the permitted list |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion except a const assertion, `as const` or `<const>x`. Assertions whose type contains `any` are CD-1's and are not repeated here.
- `as unknown` and `<unknown>x` are flagged. Widening never needs an assertion: annotate instead, `const parsed: unknown = JSON.parse(text)`.
- A cast through `unknown`, such as `raw as unknown as User`, `(<unknown>raw) as User` or one wrapped in `!` or `satisfies`, is flagged with its own message, and so is its `unknown` half. It is the escape hatch that turns any value into any type; check the value's shape at runtime at the boundary instead.
- Test files, test helpers and scripts are checked like any other source; a test that needs a cast needs a typed fake or a narrower port.
- There are no settings: a boundary that forces a cast is an exception record, as below.

## Example violation
```ts
const user = response as User;
```

## How to fix
```ts
const user = userSchema.parse(response);
```
Parse or narrow the value so the type follows from a check rather than from an assertion.

When handing a value across a boundary truly forces a cast, such as a library that types its schemas loosely or a database driver that returns unparsed rows, put the cast in the one adapter file at that boundary and record that file as an `authorised-location` with a why-chain. With clean boundaries that is one file and one record; casts scattered across many files are the sign the boundary is missing.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file sits on an external boundary that forces an assertion, such as an adapter. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-2#cast-expressions", "file": "src/adapters/row-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
