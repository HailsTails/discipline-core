# CD-15 checks

Symptom: [Loop keyword](../typescript/symptoms.md#loop-keyword).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-15#loops` | audit | `for...of`, `for await`, counted `for` and `while` loops |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Lines matching `for (... of ...)` (with or without `await`), `for (init; test; step)` and `while (`. This includes `do...while`. Each kind is reported once per line.
- Matching is on raw lines, so loop headers split over several lines are missed and the same text inside a string is flagged. Comment lines are ignored.
- The source rule names element and counted iteration; the check also flags `while`.
- Draining an `AsyncIterable` with `for await` is allowed by the rule at declared sites; record it as an `authorised-location`.

## Example violation
```ts
for (const order of orders) {
  totals.push(order.total);
}
```

## How to fix
```ts
const totals = orders.map((order) => order.total);
```
Replace a counted loop with `Array.from({ length }, (_, position) => ...)`.

In a test file, `CD-27#test-body-logic` flags `map` at either edition, and its edition 2 flags `Array.from`: write the values out instead, as [CD-27's allowed forms](../CD-27/CHECKS.md#allowed-forms-in-a-test) show.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file drains an async stream and cannot use a functional form. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-15#loops", "file": "src/streams/drain.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
