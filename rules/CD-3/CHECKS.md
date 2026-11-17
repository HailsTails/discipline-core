# CD-3 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-3#strict` | audit | `strict` is set in a `tsconfig.json` |
| `CD-3#no-unchecked-indexed-access` | audit | `noUncheckedIndexedAccess` is set |
| `CD-3#exact-optional-property-types` | audit | `exactOptionalPropertyTypes` is set |
| `CD-3#no-implicit-override` | audit | `noImplicitOverride` is set |
| `CD-3#no-fallthrough-cases-in-switch` | audit | `noFallthroughCasesInSwitch` is set |
| `CD-3#no-property-access-from-index-signature` | audit | `noPropertyAccessFromIndexSignature` is set |
| `CD-3#use-unknown-in-catch-variables` | audit | `useUnknownInCatchVariables` is set |

## What the check flags
- `tsconfig.json` files, named exactly, at any depth. `tsconfig.base.json` and other names are not read. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- For each selected clause, the matching option present in that file's `compilerOptions`. Presence is enough: `true` is flagged as well as `false`, and the shared base is not consulted.
- Options in `extends`-ed files are not seen. A file that cannot be parsed, or whose root or `compilerOptions` is not an object, fails the run.

## Example violation
```json
{ "compilerOptions": { "strict": false } }
```

## How to fix
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }
```
Put the flags in a shared base file that is not named `tsconfig.json`, and leave them out of every `tsconfig.json`. That the base file turns them on is left to review.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a package must set the flag itself. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-3#strict", "file": "packages/legacy/tsconfig.json", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
