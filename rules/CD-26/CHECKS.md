# CD-26 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-26#module-mocking` | audit | calls to `vi.mock` |

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every call spelled `vi.mock(...)`, with or without arguments.
- Not detected: `vi.doMock`, `jest.mock`, `vitest.mock` and `vi["mock"]`. Those are left to review.

## Example violation
```ts
vi.mock("./store.ts");
```

## How to fix
```ts
const subject = createSubject({ store: storeStub });
```
Pass the collaborator in as a dependency and hand the test a stub.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs to intercept a module. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs a `whyChain` as below. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-26#module-mocking", "file": "src/legacy/payments.test.ts", "reason": "..." }
] }
```

By default every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` or `file-carve-out` may give only its `reason`; a `clause-wide-carve-out` still needs its `whyChain`. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
