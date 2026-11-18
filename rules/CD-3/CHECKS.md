# CD-3 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-3#strict` | audit | `strict` is set in a `tsconfig.json`; edition 2 adds that it resolves to on |
| `CD-3#no-unchecked-indexed-access` | audit | `noUncheckedIndexedAccess` is set; edition 2 adds that it resolves to on |
| `CD-3#exact-optional-property-types` | audit | `exactOptionalPropertyTypes` is set; edition 2 adds that it resolves to on |
| `CD-3#no-implicit-override` | audit | `noImplicitOverride` is set; edition 2 adds that it resolves to on |
| `CD-3#no-fallthrough-cases-in-switch` | audit | `noFallthroughCasesInSwitch` is set; edition 2 adds that it resolves to on |
| `CD-3#no-property-access-from-index-signature` | audit | `noPropertyAccessFromIndexSignature` is set; edition 2 adds that it resolves to on |
| `CD-3#use-unknown-in-catch-variables` | audit | `useUnknownInCatchVariables` is set; edition 2 adds that it resolves to on |

## What the check flags
Each CD-3 clause has two editions. Edition 1 runs by default. Edition 2 also judges what each `tsconfig.json` inherits, and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- `tsconfig.json` files, named exactly, at any depth. `tsconfig.base.json` and other names are not read. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- For each selected clause, the matching option present in that file's `compilerOptions`. Presence is enough: `true` is flagged as well as `false`.
- Options in `extends`-ed files are not seen. A file that cannot be parsed, or whose root or `compilerOptions` is not an object, fails the run.

Edition 2 also flags, for each selected option a `tsconfig.json` does not set itself, an option its resolved configuration leaves off:
- The configuration is resolved by the repository's installed TypeScript, as `tsc` would resolve it: every file in the `extends` chain, a relative path, a package such as `@tsconfig/strictest` or a workspace package under `node_modules`, and an array of bases on TypeScript 5.0 or later, later bases winning. An option a base turns on and a later file turns off is off.
- `strict` and `useUnknownInCatchVariables` take TypeScript's defaults: TypeScript 6 treats `strict` as on when nothing sets it, and `useUnknownInCatchVariables` follows `strict` unless it is set.
- The finding names the file to edit. `= false, inherited from <base>` names each base that turns the option off. `= false, turned off in <file>` names this `tsconfig.json` when its own `"strict": false` turns `useUnknownInCatchVariables` off. `unset here and in <bases>` lists every file in the chain, none of which sets the option; `unset, and this file extends no base` says there is no chain.
- A configuration TypeScript cannot resolve, such as a base file that is missing, a package that is not installed, or bases that extend each other, is flagged for each selected option the file does not set as `unknown`, followed by TypeScript's own diagnostic. An `extends` holding `${configDir}` resolves however the installed TypeScript resolves it, and is flagged the same way when TypeScript cannot find it. Fix the chain, and the options are judged.
- The base files are judged through the `tsconfig.json` files that extend them, not on their own.
- A `tsconfig.json` that compiles no files is not judged on what it resolves to, since its options apply to no file: one whose `files` list is empty, its own or inherited, and that has no `include`, such as the solution-style root with only `references` that `npm create vite` writes. An option it sets itself is still flagged, as in edition 1. The configs it references are not judged through it; only files named `tsconfig.json` are read.

## Example violation
```json
{ "compilerOptions": { "strict": false } }
```

## How to fix
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }
```
Put the flags in a shared base file that is not named `tsconfig.json`, and leave them out of every `tsconfig.json`. Under edition 1, that the base file turns them on is left to review. Under edition 2 the check reads the base: turn every selected flag on in it.

```json
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true, "noImplicitOverride": true, "noFallthroughCasesInSwitch": true, "noPropertyAccessFromIndexSignature": true, "useUnknownInCatchVariables": true } }
```

## Settings
- `edition`: the edition this clause runs, `"1"` or `"2"`. Without it, the clause runs edition 1, or the latest edition when `checkEditions` in `disciplines.json` is `"latest"`.

```json
"clauseSettings": {
  "CD-3#no-unchecked-indexed-access": { "edition": "2" }
}
```

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a package must set the flag itself. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs a `whyChain` as below. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-3#strict", "file": "packages/legacy/tsconfig.json", "reason": "..." }
] }
```

By default every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` or `file-carve-out` may give only its `reason`; a `clause-wide-carve-out` still needs its `whyChain`. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
