# CD-8 checks

Symptom: [Default on a closed union](../typescript/symptoms.md#default-on-a-closed-union).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-8#switch-defaults` | audit | a `default:` arm inside a `switch` |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line matching `default:` while inside a `switch (`, tracked line by line by counting braces. One finding per line; comment lines are ignored.
- Every `default:` is flagged. The check cannot tell whether the switch is over a closed union, so a switch over an open set (a plain string) needs an exception. Other `default:` text inside a switch, such as an object key, is flagged too.

## Example violation
```ts
switch (event.kind) {
  case "opened": return open();
  default: return ignore();
}
```

## How to fix
```ts
switch (event.kind) {
  case "opened": return open();
  case "closed": return ignore();
}
```
Name each remaining variant so the compiler checks exhaustiveness.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a switch is over an open set of values and needs a fallback. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-8#switch-defaults", "file": "src/parsing/token-reader.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
