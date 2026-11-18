# CD-41 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-41#cognitive-complexity` | eslint | a function whose cognitive complexity is above 15 |
| `CD-41#function-length` | eslint | a function body longer than 50 lines |
| `CD-41#orchestration-only` | review | an orchestrator only composes helper calls and assembles their results |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-41/README.md).
- `hone-cd41/cognitive-complexity`: each function's cognitive complexity must be at most 15.
  - An `if`, `else if`, `switch`, ternary, `catch` and each loop adds 1 plus the current nesting depth.
  - An `else`, a `finally`, a labelled `break` or `continue`, and each run of the same logical operator add 1.
  - Nesting deepens inside `if`, loops, `switch`, `catch` and ternaries.
  - A nested function is scored on its own, starting one level deeper, and its score is not added to its parent.
  - Reported at the function's name.
- `hone-cd41/function-length`: a function body may span at most 50 lines. Blank and comment lines count; lines holding only `{` or `}` do not. Getters and setters are not checked. Reported at the function.
- `orchestration-only` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
const settle = (orders: Order[]) => {
  for (const order of orders) {
    if (order.paid) {
      for (const line of order.lines) {
        if (line.refundable && line.quantity > 0) {
          refund(line);
        }
      }
    }
  }
};
```

## How to fix
```ts
const settle = (orders: Order[]) => orders.filter(isPaid).forEach(refundEligibleLines);
```
Move each branch into a named helper so the orchestrator only composes calls.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file holds a function whose shape is fixed by an external contract. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-41#cognitive-complexity", "file": "src/legacy/tax-engine.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
