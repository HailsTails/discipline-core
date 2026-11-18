# CD-25 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-25#dependency-isolation` | audit | `vi.fn(<implementation>)` and `.mockImplementation(...)` |

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A `vi.fn(...)` call with any argument, and any call to a method named `mockImplementation` (on any receiver, with or without arguments).
- Allowed: `vi.fn()`, `.mockReturnValue(...)`, `.mockResolvedValue(...)`, `.mockReturnValueOnce(...)` and `.mockImplementationOnce(...)`.
- `.mockImplementationOnce(...)` is not flagged even though it takes an implementation; whether that implementation gives the double behaviour is left to review.
- The source rule is wider (no real I/O, no real collaborators). Whether a unit is isolated is left to review.

## Example violation
```ts
const clock = { now: vi.fn(() => 1) };
```

## How to fix
```ts
const clock = { now: vi.fn().mockReturnValue(1) };
```
Return a canned value: that double is a stub. If the double needs logic, the seam is probably too wide, or the double is a fake that belongs in a shared in-memory implementation of the port with its own tests.

## Exceptions
A double that legitimately needs behaviour is a fake: write it once as an in-memory implementation of the port, in its own module with its own tests, and pass it in. That is the home for the behaviour, not an exception for a test file. For debt in one file, add a `file-carve-out` entry to `discipline-exceptions.json` at the repository root: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "file-carve-out", "clause": "CD-25#dependency-isolation", "file": "src/legacy/billing.test.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
