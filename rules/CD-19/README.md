# CD-19: External dependencies confined to wrapping ports at the boundary

## Rule

Every dependency on code the project does not own — a third-party library or the runtime's own standard library alike — is confined to a single wrapping port at the boundary; the rest of the codebase depends on that port, never the vendor or platform surface, runtime or type-only. A dependency swap then touches one file, the vendor's types never leak inward, and each confined capability is nameable and fakeable in tests. There is no inline carve-out: a stdlib call in the middle of business logic is as much a violation as a scattered library import. Opening a new wrapping site for a new dependency is a deliberate, recorded decision.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-19#import-boundaries` | audit | imports of the library specifiers the repository confines, and any `node:` import |

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line with `from "<name>"` for each `<name>` listed in the clause's `confinedSpecifiers` setting (see [Settings](#settings)). A name matches only that exact specifier, so `hono` and `hono/cors` are listed separately. With no names listed, which is the default, no library import is flagged. Type-only imports and matches inside strings are flagged too.
- A `node:` specifier in an import, `export ... from`, `import("node:...")`, `import type`, `import x = require(...)` or `require("node:...")`. Unprefixed `fs` is not detected.
- The source rule covers every third-party dependency; the check covers only the listed specifiers. The rest is left to review.

## Settings
List the specifiers of each library the repository confines behind a wrapping port in `disciplines.json`, then record each wrapping file as an `authorised-location`:

```json
"clauseSettings": {
  "CD-19#import-boundaries": { "confinedSpecifiers": ["winston", "uuid"] }
}
```

## Example violation
```ts
import { readFileSync } from "node:fs";
import { v4 } from "uuid";
```

## How to fix
```ts
import { createFileReader } from "./file-reader.ts";
import { createIdGenerator } from "./id-generator.ts";
```
Import your own port. Only the wrapping file imports the library.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` for the file that is the wrapping boundary for that dependency. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-19#import-boundaries", "file": "src/adapters/file-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
