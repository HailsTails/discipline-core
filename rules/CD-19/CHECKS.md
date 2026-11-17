# CD-19 checks

Read [the rule and its spirit](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-19#import-boundaries` | audit | imports of the packages the repository confines, and any `node:` import |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line with `from "<specifier>"` where the specifier is a package listed in the clause's `confinedPackages` setting (see [Settings](#settings)) or a subpath of one: `hono` covers `hono` and `hono/cors`, and `@scope/name` covers `@scope/name` and `@scope/name/client`. A longer name is a different package, so `hono` does not cover `honox` or `hono-extra`. With no packages listed, which is the default, no library import is flagged. Type-only imports and matches inside strings are flagged too.
- A `node:` specifier in an import, `export ... from`, `import("node:...")`, `import type`, `import x = require(...)` or `require("node:...")`. Unprefixed `fs` is not detected.
- The source rule covers every third-party dependency; the check covers only the listed packages. The rest is left to review.

## Settings
List each package the repository confines behind a wrapping port in `disciplines.json`, then record each wrapping file as an `authorised-location`:

```json
"clauseSettings": {
  "CD-19#import-boundaries": { "confinedPackages": ["winston", "uuid"] }
}
```

## Example violation
With `"confinedPackages": ["uuid"]`, both lines are flagged; with the default, only the first.
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
