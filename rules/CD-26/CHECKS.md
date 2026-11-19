# CD-26 checks

Symptom: [Module or global patched](../typescript/symptoms.md#module-or-global-patched).

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
Add an entry to `discipline-exceptions.json` at the repository root. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. The form accepts an `authorised-location` for this clause, as for any; in spirit [Module or global patched](../typescript/symptoms.md#module-or-global-patched) has no correct use, and a reviewer refuses one. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "file-carve-out", "clause": "CD-26#module-mocking", "file": "src/legacy/payments.test.ts" }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
