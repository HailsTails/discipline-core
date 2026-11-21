# CD-17 checks

Symptom: [Date used directly](../typescript/symptoms.md#date-used-directly).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-17#clock-sources` | audit | `Date.now()` and `new Date` |

## What the check flags
- `.ts` and `.tsx` files, including tests. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped.
- Any line containing `Date.now()` or `new Date`, one finding per line. Comments and strings are matched too.
- Other time sources (`performance.now`, timers) are not checked; they are left to review.
- Other generated code can be left out of the check's scope with `exclude` in disciplines.json. Hand-written code that reads the time is not out of scope; it needs the clock port.

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
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` for the file that is the single real clock implementation. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-17#clock-sources", "file": "src/adapters/system-clock.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
