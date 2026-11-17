# CD-8 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

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
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a switch is over an open set of values and needs a fallback. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs a `whyChain` as below. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-8#switch-defaults", "file": "src/parsing/token-reader.ts", "reason": "..." }
] }
```

By default every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` or `file-carve-out` may give only its `reason`; a `clause-wide-carve-out` still needs its `whyChain`. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
