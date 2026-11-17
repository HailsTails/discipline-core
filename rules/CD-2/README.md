# CD-2: Closed enumerated list of permitted cast sites

## Rule

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it (library-introspection and raw-row narrowing shapes the project names explicitly). Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-2#cast-expressions` | audit | a type assertion that is not on the permitted list |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion except the permitted forms. Assertions that CD-1 reports (`any`) are not repeated here.
- Permitted by default: `as unknown` and `as const`. Every other `as` cast and every `<T>x` assertion is flagged until the repository names it in [Settings](#settings).
- Further sites in a single file are handled as exceptions.

## Settings
The project names its own permitted cast shapes in `disciplines.json`. Both lists are empty by default and are shared with `CD-1#any-cast`, which applies the same permitted list:

```json
"clauseSettings": {
  "CD-2#cast-expressions": {
    "permittedCastTypes": ["ReadonlyArray", "Tool[\"inputSchema\"]"],
    "permittedCastTypePackages": ["zod"]
  }
}
```

- `permittedCastTypes` permits `x as T` when `T` is a listed type name as written, ignoring type arguments (`ReadonlyArray` covers `ReadonlyArray<Row>`; `z.ZodType` is written with its qualifier), or a listed indexed access written as `Name["key"]` (either quote style in source matches).
- `permittedCastTypePackages` permits `x as T` when `T` is a name the file imports by name, aliases included, from a listed package or one of its subpaths: `zod` covers `zod` and `zod/v4`, not `zodiac`. Default and namespace imports are not covered.
- Each entry must be a non-empty string, and both settings must be present; a malformed value stops the check with a piece-invalid failure naming the clause.

## Example violation
```ts
const user = response as User;
```

## How to fix
```ts
const user = userSchema.parse(response);
```
Parse or narrow the value so the type follows from a check rather than from an assertion.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file sits on an external boundary that forces an assertion, such as an adapter. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-2#cast-expressions", "file": "src/adapters/row-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
