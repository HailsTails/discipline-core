# CD-7a checks

Symptom: [Type derived from code](../typescript/symptoms.md#type-derived-from-code).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-7a#factory-return-types` | audit | a line containing `ReturnType<typeof` |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Any line matching `ReturnType<typeof`, one finding per line. This includes `Awaited<ReturnType<typeof ...>>` and matches inside strings.
- Lines starting with `//`, `/*` or `*` are ignored. A `ReturnType<` and `typeof` split across lines are not seen.
- The source rule's carve-out, an external library symbol with no exported return type, is not detected; record it as an exception.

## Example violation
```ts
type Client = ReturnType<typeof createClient>;
```

## How to fix
```ts
export type Client = { readonly send: (message: string) => void };
const createClient = (): Client => ({ send: () => undefined });
```
Declare and export the type, then annotate the factory with it.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when the type comes from a library whose package exports no named return type. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-7a#factory-return-types", "file": "src/adapters/vendor-client.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
