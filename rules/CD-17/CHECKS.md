# CD-17 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-17#clock-sources` | audit | `Date.now()` and `new Date` |

## What the check flags
- `.ts` and `.tsx` files, including tests. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder or file can be left out with `exclude` in disciplines.json.
- Any line containing `Date.now()` or `new Date`, one finding per line. Comments and strings are matched too.
- Other time sources (`performance.now`, timers) are not checked; they are left to review.

## Example violation
```ts
const startedAt = Date.now();
```

## How to fix
```ts
const startedAt = clock.now();
```
Accept a clock as a dependency and read time only through it. The one real implementation lives in an adapter.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` for the file that is the single real clock implementation. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-17#clock-sources", "file": "src/adapters/system-clock.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
