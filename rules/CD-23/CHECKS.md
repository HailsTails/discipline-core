# CD-23 checks

Symptom: [Unit without a running test](../typescript/symptoms.md#unit-without-a-running-test).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-23#export-test-sibling` | audit | a production file with a runtime export and no `.test` sibling |

## What the check flags
- Production `.ts` and `.tsx` files. Skipped: `*.test.ts(x)`, `.d.ts` and anything under `__tests__`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder or file can be left out with `exclude` in disciplines.json.
- A file with a runtime export (`export const`, `function`, `class`, `enum`, `export default`, or `export { name }`) and no `<name>.test.ts` beside it (`<name>.test.tsx` for `.tsx`). The sibling must be in the repository's file list.
- Allowed: files with only `export type`, `export interface`, `export declare`, type-only named exports or `export * from`, and files with no exports.
- The source rule asks for a test beside every source file; files without runtime exports are left to review.

## Example violation
```ts
export const price = 1;
```
This is `src/price.ts` with no `src/price.test.ts` beside it.

## How to fix
Add `src/price.test.ts` next to the file, with at least one test of its behaviour.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. The form accepts an `authorised-location` for this clause, as for any; in spirit a unit that only wires has a test of its wiring. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "file-carve-out", "clause": "CD-23#export-test-sibling", "file": "src/legacy/report.ts" }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
