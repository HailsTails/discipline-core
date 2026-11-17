# Hone

[![npm version on the next dist-tag](https://img.shields.io/npm/v/%40hailstails%2Fhone/next)](https://www.npmjs.com/package/@hailstails/hone)
[![CI on main](https://github.com/HailsTails/hone/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HailsTails/hone/actions/workflows/ci.yml?query=branch%3Amain)
[![Unpacked size on the next dist-tag](https://img.shields.io/npm/unpacked-size/%40hailstails%2Fhone/next)](https://www.npmjs.com/package/@hailstails/hone)
[![Supported Node versions on the next dist-tag](https://img.shields.io/node/v/%40hailstails%2Fhone/next)](https://www.npmjs.com/package/@hailstails/hone)
[![Licence](https://img.shields.io/npm/l/%40hailstails%2Fhone)](LICENSE)

Hone checks a repository against the disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Its core enforces nothing and names no discipline and no mechanism. A discipline (for example CD-14, no authored classes) is data under `rules/`, and a mechanism is a runner under `mechanisms/`; the core reaches both only through files and one module contract.

**Install the npm package `@hailstails/hone`.** The unscoped name `hone` on npm belongs to an unrelated package: never run `npm install hone`. `@hailstails/hone` installs one command, `hone`:

```bash
npm install --save-dev @hailstails/hone@next
```

Releases are pre-releases, published to npm under the dist-tag `next`, until a stable release is published under `latest`; the badge above shows the version `next` installs. The alternative is the tarball attached to each [GitHub release](https://github.com/HailsTails/hone/releases), installed with `npm install --save-dev <path-to-tarball>`. A repository on the package's old name, `honed`, moves with [MIGRATING.md](MIGRATING.md#11-moving-from-honed-to-hailstailshone). [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps, and the alternative of building the tarball from a pinned commit.

Two mechanisms ship: `audit`, a standalone TypeScript syntax walker, and `eslint`, which runs the clause as an ESLint rule inside the team's own ESLint setup. [rules/README.md](rules/README.md) lists every shared discipline with its clauses: the audit mechanism checks 20 disciplines, and ESLint pieces check clauses of CD-1, CD-6, CD-7, CD-10, CD-14, CD-27, CD-40, CD-41, CD-42 and CD-44. The rest are judgement rules, applied in review with the review methods in [methods/](methods/README.md).

To adopt Hone in another repository, follow [ADOPTING.md](ADOPTING.md) step by step. A repository already using the older standalone route, or a copy of Hone's source, follows [MIGRATING.md](MIGRATING.md) instead.

A team adds its own disciplines as a rule set in its own repository, with ESLint and audit pieces, following [docs/extending.md](docs/extending.md). Adding a discipline or a mechanism to Hone itself, and the full list of ESLint native channels, are covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

The package ships one command, `hone`, with two subcommands, run through a `package.json` script as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) shows:

```text
hone check --repo <dir> [--base-revision <rev>] [--report-output <output>] [--forfeiture <this-run|elsewhere>] [--waived-clauses <run|not-run>]
hone project --repo <dir>
```

`hone` with no subcommand, or with one it does not know, is a load failure `arguments-invalid` whose line ends with the usage, and exits `2`. From a source checkout the same command is `node core/check/tool-command.ts check --repo <dir>`.

`hone check` loads the repository's selection, exceptions, rule sets and pieces; works out which files changed since `--base-revision`; runs each selected mechanism once over the repository's tracked `.ts`, `.tsx`, `.mts` and `.cts` files; applies the exceptions; and prints a plain-text report ending in `verdict: pass` or `verdict: fail`.

| Exit | `hone check` | `hone project` |
| --- | --- | --- |
| `0` | the verdict is `pass` | every projection was written or already current |
| `1` | the verdict is `fail` | not used |
| `2` | an input could not be loaded, or a mechanism failed or returned invalid output | any failure |

A load failure prints one line, `load failure: <kind> <fields>`.

The report lists the excluded paths, the clauses not adopted, findings, exempted findings, uncovered clauses, stale, forfeited, unrecorded and doubly-held exceptions, invalid exception records, unmeasured checks, projection problems and any part of the assessment left to another run, each with its count. The verdict is `pass` only when every list except the excluded paths, clauses not adopted, exempted findings and assessment is empty.

`--report-output` sets how much of the report is printed for one run, overriding `reportOutput` in `disciplines.json`; with neither, the output is `full`.

| Output | Prints |
| --- | --- |
| `full` | every non-empty section with its entries, then the verdict |
| `failures-only` | the same without the `excluded`, `exempted` and `assessment` sections |
| `counts` | one `<section> (<count>)` line per non-empty section, with ` informational` after `excluded`, `exempted` and `assessment`, then the verdict |
| `verdict-only` | only the verdict line |

The output changes only what is printed: the verdict and exit code always come from the whole report. An unknown `--report-output` value is a load failure `arguments-invalid`; an unknown `reportOutput` value makes `disciplines.json` `file-malformed`, even when `--report-output` is given. Load failures print the same in every output.

Without `--base-revision`, Hone cannot tell which files were touched, so a file carve-out cannot be forfeited; if any file carve-out exists the report lists `forfeiture-unmeasured` and the run fails. For the same reason it cannot tell whether an entry with an earlier-contract why-chain is unchanged; if one exists the report lists `legacy-chain-unmeasured` and the run fails.

`--forfeiture elsewhere` makes a run leave carve-out decay to another run, such as a pre-push hook given a base revision, overriding `assessment.forfeiture` in `disciplines.json`; `--forfeiture this-run`, the default, assesses it in this run. A run with forfeiture elsewhere asks git for no change set, forfeits no file carve-out and never reports `forfeiture-unmeasured`, with or without `--base-revision`. It ends its report with an `assessment` section, printed whenever the run assesses less than the default, and marks its verdict line in every output:

```text
assessment (1)
forfeiture elsewhere: 37 file carve-outs not checked for decay in this run
verdict: pass (partial assessment)
```

The `assessment` section is informational and the marker does not change the exit code. Forfeiture elsewhere changes nothing else: `--base-revision` given with it is used only to check imported entries and legacy chains, and a run without a base revision still reports `import-unmeasured` and `legacy-chain-unmeasured` as above.

`--waived-clauses not-run` makes a run skip every selected clause a valid `clause-wide-carve-out` covers, overriding `assessment.waivedClauses` in `disciplines.json`; `--waived-clauses run`, the default, runs them as before. A mechanism left with nothing to run is not loaded at all, so a repository that waives every `eslint` clause needs no ESLint installed. A mechanism that still has another clause to run skips just the waived ones: ESLint never switches a waived rule on, while its projection is still judged against every selected clause, the waived clause and its `"off"` block included. When every ESLint clause is waived, ESLint is not loaded, so the projection's freshness is not checked in that run. Only the waived clauses' execution and the staleness of the records on them are skipped: `stale` is not judged for those records, while invalid records, forfeiture, doubly-held records and `uncovered` are reported as before, and `hone project` still writes the waived rules and their `"off"` blocks. The `assessment` section names each clause not run:

```text
waived-clauses not-run: 1 clause not run, 1 record not judged stale: CD-6#naming-convention eslint
```

`hone project` writes the native configuration each embedded mechanism needs, and prints `<path> <effect>` per file (`written` or `unchanged`). The audit mechanism is standalone and writes nothing, so with only the walker selected the command prints nothing and exits `0`.

## Adopting the ESLint mechanism

With any clause selected for `eslint`, run `hone project`. It writes `disciplines.eslint.mjs` at the repository root: one block per piece enabling its selected rules at `"error"` on `**/*.{ts,tsx,mts,cts}`, then one block per set of clauses that files are excepted from, listing those files and turning the rules `"off"` for them, and one block per clause-wide carve-out turning its rules `"off"` everywhere. Commit it, and spread its default export last in the repository's flat config:

```js
import disciplines from "./disciplines.eslint.mjs";

export default [
  // the team's own blocks
  ...disciplines,
];
```

This is the only supported way to adopt the rules. On every check, Hone reads the team's resolved configuration for each checked file and fails the run if the projection is missing (`mechanism-not-run eslint missing`), not in effect (`mechanism-not-run eslint not-included`), or differs from what `hone project` would write now (`eslint out-of-date`). Re-run `hone project` after changing the selection or the exceptions.

A file carve-out stays in the projection after it is forfeited, so the team's own ESLint run keeps ignoring that file; Hone's check is what fails it, as `forfeited`.

Hone's own ESLint run uses only the runner's configuration, with ignores, suppressions and inline configuration off, so nothing in the team's setup can change a finding. Every way the team's setup can weaken a selected rule (a native channel) is reported instead, and only an override that matches an exception record is accepted. The guide has the table.

## disciplines.json

At the repository root. It selects clauses and the mechanism that checks each one.

```json
{
  "version": 1,
  "ruleSets": { "team": "tools/disciplines" },
  "clauses": {
    "CD-14#class-syntax": "eslint",
    "CD-14#static-only-class": "eslint",
    "team/TD-1#some-clause": "audit"
  },
  "exclude": ["vendor", "generated"]
}
```

- `ruleSets` names the repository's own rule sets, each a directory relative to the repository root. The name `hone` is reserved for the rule set shipped with the tool; `hone/CD-15#loops` and `CD-15#loops` are the same address. A rule-set name may not start with `hone-`, and no declared name may be another declared name plus `-<suffix>`.
- `clauses` maps a clause address to a mechanism id, or to `"not-adopted"`. An address is `[<ruleSet>/]<DisciplineId>#<clauseId>`; no prefix means the `hone` rule set. The mechanism must be one the clause lists.
- Listing a clause adopts its discipline. Mechanical clauses of an adopted discipline that are not listed are reported as uncovered, and fail the run.
- `"not-adopted"` states that the repository does not adopt that clause. It is never run and never projected, and its mechanism is not loaded unless another clause uses it. The report lists it under `notAdopted`, which is informational: the run is still a whole assessment. An exception record on it is invalid as `clause-not-adopted`, and `clauseSettings` for it make `disciplines.json` `file-malformed`: remove them. The clause must still exist and be mechanical, in any rule set; a judgement clause is never listed, adopted or not, and fails the run as `judgement-clause-listed`. No mechanism may be named `not-adopted`.
- A judgement clause cannot be selected; it is enforced by review.
- `eslintConfigLookup`, optional, is `"nearest-to-file"` or `"repository-root"` and says which `eslint.config.*` the team's own ESLint run applies to a file; see [Runtime](#runtime). Leave it out to let Hone detect it.
- `fileExceptionWhyChains`, optional, is `"required"` (the default) or `"optional"`. `"optional"` lets an `authorised-location` or `file-carve-out` entry give only its `reason`; see [discipline-exceptions.json](#discipline-exceptionsjson).
- `reportOutput`, optional, is `"full"` (the default), `"failures-only"`, `"counts"` or `"verdict-only"`: the repository's default for how much of the report the check prints. `--report-output` overrides it for one run; see [Commands](#commands).
- `clauseSettings`, optional, maps a selected clause address to an object of that clause's settings, for a clause whose CHECKS.md lists settings. Each key must be one the clause's piece declares, and its value must be the same JSON kind as the declared default and, where the piece lists choices, one of them; the value replaces the default. Anything else makes `disciplines.json` malformed, naming the clause, the key and what is accepted: settings for a clause the file does not select or names twice, for a clause that takes none, under an undeclared key, or of the wrong kind or choice.
- `assessment`, optional, says which run assesses each concern. `forfeiture` is `"this-run"` (the default) or `"elsewhere"`, and `--forfeiture` overrides it for one run. `waivedClauses` is `"run"` (the default) or `"not-run"`, and `--waived-clauses` overrides it for one run. See [Commands](#commands). Any other key makes `disciplines.json` `file-malformed`, naming the key as not available in this version.
- `exclude`, optional, lists repository folders or exact files that no mechanism checks. A folder entry covers everything under it. Globs are refused: an entry containing `*` makes `disciplines.json` malformed. The report lists the active entries under `excluded`. Exclude Hone's own install when it is vendored inside the repository.

## discipline-exceptions.json

At the repository root; absent means no exceptions. Each entry names a selected clause, and applies to the mechanism that clause is selected for.

```json
{
  "version": 1,
  "exceptions": [
    { "kind": "authorised-location", "clause": "CD-14#class-syntax", "file": "src/adapter.ts", "reason": "..." },
    { "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/legacy.ts", "reason": "...", "whyChain": { } },
    { "kind": "clause-wide-carve-out", "clause": "CD-14#class-syntax", "reason": "...", "whyChain": { } }
  ]
}
```

- An `authorised-location` says the clause does not apply to that file.
- A `file-carve-out` is debt in one file. It is forfeited once the file is touched.
- A `clause-wide-carve-out` exempts the clause everywhere.
- Every entry needs a `whyChain` (an `authorised-location` or `file-carve-out` may leave it out when `fileExceptionWhyChains` is `"optional"`; see below) that follows the [why-chain contract](docs/why-chain-contract.md): exactly five `{ "why", "because", "evidence" }` steps chained cause to cause, then `rootCause`, `rootCheck`, `readback` and `owner`. The contract lists what Hone refuses and what review still judges:

  ```json
  "whyChain": {
    "whys": [
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." }
    ],
    "rootCause": "...",
    "rootCheck": "...",
    "readback": "...",
    "owner": "..."
  }
  ```
- A chain with neither `rootCheck` nor `readback` was written to the earlier contract. It is accepted only while the `--base-revision` holds its entry unchanged; a new or edited one is refused as `why-chain-refused`, and a run with such a chain and no `--base-revision` is `legacy-chain-unmeasured`.
- An entry carried over from an earlier system may give `provenance` instead of a `whyChain`: `{ "kind": "inherited-debt", "source", "decision" }` on a file carve-out, `{ "kind": "existing-authorisation", "source" }` on an authorised location. `source` names the old record entry as `<directory>/cd-<id>.json#<index>`: `.constitution-carve-outs` for inherited debt, `.constitution-authorised-locations` for an existing authorisation, the old file for the record's discipline, and the entry's position in its array. Such an entry is imported, and is accepted only while the `--base-revision` already holds it unchanged, or, when the base holds no record for that kind, clause and file, while the `source` entry at that revision lists the file in its `files`. A new or edited entry without a `whyChain` is refused as `import-unverified`, and a run with imported entries and no `--base-revision` is `import-unmeasured`. The report names each imported entry it exempts by.
- With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` or `file-carve-out` entry may give only its `reason`, which then carries why the exception exists and must not be blank. The entry itself is not checked against `--base-revision`, but a run with any file carve-out still needs `--base-revision`: without it the report lists `forfeiture-unmeasured` and the run fails, and with it a file carve-out is forfeited once its file is touched. A `whyChain` or `provenance` the entry gives anyway is still judged as above. A `clause-wide-carve-out` still needs its `whyChain`.
- A clause whose `discipline.json` declares `"exceptions": "refused"` cannot be exempted. No shipped discipline declares it, so every shipped clause can be.
- Files are exact repository paths, never globs.
- An entry that exempts nothing is stale, a file both authorised and carved for one clause is doubly held, and an entry that cannot be parsed is invalid. Each fails the run.

## Installing

Hone installs as one npm package, `@hailstails/hone`, installed as `@hailstails/hone@next` from npm, downloaded as the tarball `hailstails-hone-<version>.tgz` attached to a GitHub release, or built by `pnpm run pack-package` into `artefacts/hailstails-hone-<version>.tgz`, the file name `npm pack` gives the scoped package, and added to the repository root as a development dependency; [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps. The package is plain JavaScript with `zod`, `jsonc-parser` and `@eslint/plugin-kit` bundled in, so it has no `dependencies`; its licences are reproduced in `THIRD-PARTY-NOTICES.md` inside it. It declares the toolchain as `peerDependencies`, `typescript` required and the ESLint packages optional, and exposes one command, `hone`, whose subcommands `hone check` and `hone project` are described under Commands. It ships the rule data and pages, both mechanisms, the review methods and the why-chain contract, and no TypeScript source, only the declaration files of the public type entries below.

With the ESLint mechanism selected, a packaged install's projection imports each piece by package name, `@hailstails/hone/mechanisms/eslint/<DisciplineId>/...`, so the repository's ESLint must resolve the package from the repository root. Hone compares the committed projection `disciplines.eslint.mjs` byte for byte with what `hone project` would write now.

## Public type entries

The package has two public entries for TypeScript. Each holds types only, so importing one adds no code to a build; import them with `import type`.

| Entry | Status | What it is for |
| --- | --- | --- |
| `@hailstails/hone/rule-set` | Stable | The shapes of `discipline.json`, `piece.json` and an ESLint piece's `settings`, for a team writing its own rule set. Identifiers and paths are plain strings: Hone checks them when it reads the files. |
| `@hailstails/hone/audit` | Experimental | The types for writing an audit walker piece, `WalkerPiece` and what it needs, including `PieceFailure`, the failures a piece may return. Clause addresses and file paths reach a piece from Hone, already checked, and a piece passes them back unchanged. It may change in a minor release. |

Both resolve with `moduleResolution` `"nodenext"` or `"bundler"`. `install-proof` type-checks a team piece and rule set against them, and checks that a wrongly typed field fails: on TypeScript 4.8.4 from an ES module with `"nodenext"` (4.8 has no `"bundler"`), and on 6.0.3 from an ES module with both and from a CommonJS file. A CommonJS file (`.cts`, or `.ts` in a package that is not `"type": "module"`) can import these types on TypeScript 5.8 or later with `module` `"nodenext"`. With `module` `"node16"`, and on TypeScript 5.3 to 5.7, the import needs `with { "resolution-mode": "import" }`, and older versions reject it. These CommonJS figures were checked once by hand, on 5.8.2, 5.3.3 and 6.0.3 with `"node16"`; `install-proof` checks only the 6.0.3 CommonJS case with `"nodenext"`. `@hailstails/hone/audit` names TypeScript's own syntax types, so it needs the `typescript` the repository already installs as a peer. No other path in the package is a public TypeScript entry.

## Runtime

- Windows, Linux, macOS or WSL. Hone keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them.
- The package: Node `^22.18.0 || >=24` (its `engines.node`). It is plain JavaScript, so Node never strips types from it, and from 22.18.0 Node strips types from a rule set's `.ts` piece modules, within the limits [ADOPTING.md](ADOPTING.md#1-check-the-prerequisites) lists.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- Hone's own packages, `zod`, `jsonc-parser` and `@eslint/plugin-kit`, exact-pinned in `dependencies` and locked by `pnpm-lock.yaml`: bundled into the package. They are implementation details: nothing of theirs crosses into the repository's code or configuration.
- The repository's own toolchain, declared as `peerDependencies`: `typescript` `>=4.8.4 <7.0.0`, a required peer because every audit clause needs it, and for the ESLint mechanism the optional peers `eslint` `^9.28.0 || ^10.0.0`, `@typescript-eslint/parser` `^8.56.0` and `@typescript-eslint/eslint-plugin` `^8.56.0`. npm 7 and later install a missing required peer on their own, so declare `typescript` at the root at the version the repository uses. Each floor is the oldest release Hone is tested on: TypeScript 4.8 is the oldest whose syntax API the audit uses (`getModifiers`), ESLint 9.28.0 the first 9.x with every bulk-suppressions option a carve-out kept in `eslint-suppressions.json` relies on (`--pass-on-unpruned-suppressions` came last), and typescript-eslint 8.56.0 the first whose peer range accepts ESLint 10. TypeScript stops below 7 because TypeScript 7's compiler API is a different one. Yarn Plug'n'Play is not supported.

Hone loads the toolchain by Node's own resolution, upward from the install directory, which is the same resolution the pieces' plugin modules get when the team's ESLint loads the projection. Hone's query of the team's configuration, its governance run and the pieces therefore all use one copy, the repository's. Keep the toolchain resolvable from the repository root: declare it in the root `package.json` (in a pnpm workspace, `pnpm add -Dw`). A package may install a different ESLint for its own lint script; Hone's verdict still comes from the root's, its governance behaviour is the same on either supported line, and the pieces that wrap native rules wrap the root's copies there too. Hone's tests run the governance path and every piece's shared cases on four ESLint lines, 9.28.0 and 10.0.0 with typescript-eslint 8.56.0 and 9.39.5 and 10.11.0 with 8.71.2, and the audit pieces' shared cases on TypeScript 4.8.4 and 6.0.3; the in-process consumer fixtures run on ESLint 10.11.0, and `install-proof` runs real consumers on each floor.

A peer that is missing, cannot load, or is outside its range stops the mechanism before any piece loads, with one line such as `load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.28.0 || ^10.0.0: add a supported version to the devDependencies of the repository root`. The line names every peer of that mechanism that is unavailable, separated by `; `, and then asks for a supported version of each, so one install fixes them all. A `typescript` that is not installed at all is reported the same way, with the line saying that `typescript` is a required peer of `@hailstails/hone` and the install is incomplete, since a supported install always has it; one that is installed but out of range or unloadable gets the plain line. A peer that resolves from inside the installed package, such as an `eslint` left in `node_modules/@hailstails/hone/node_modules`, stops it as `toolchain-shadowed`, naming where it resolved and the folder to delete before reinstalling core. A source checkout of Hone is its own development install, so its development toolchain in its own `node_modules` is not a shadow.

A repository can hold one `eslint.config.*` at its root or one per package. Hone resolves the team's configuration the way the team's own ESLint run does. ESLint 10, and ESLint 9 started with `--flag v10_config_lookup_from_file` (or `unstable_config_lookup_from_file`), use the `eslint.config.*` nearest each checked file. Plain ESLint 9 uses only the one in the directory it runs from, so for a repository whose `eslint` resolves to 9.x at `node_modules/eslint` and whose lint scripts carry no such flag, Hone reads the root `eslint.config.*` for every file, and fails the run as `team-config-unloadable` if there is none. When Hone cannot read an installed `eslint` at the repository root it assumes the nearest-to-file lookup. Each config that applies to a file must spread the projection. A config that fails to load stops the run as `team-config-unloadable`, naming the config, the checked file it applies to and ESLint's message, then the next step: fix that config. Only if its folder holds nothing Hone should check, add it to `exclude` in `disciplines.json` instead. A broken config in a folder that the repository's own ESLint never enters does not stop the run. Before failing, Hone asks the config that governs that folder, and each config above it up to the root, whether it really ignores both that folder and the file; a file that no `files` block matches is not taken for an ignored one. If one does, the file is treated like any other file the team's ESLint ignores and reported as an `ignore` native exception. Hone asks about a folder through a file inside it, so one gap remains: an ignore that matches every entry directly inside the folder but not the folder itself, such as `gen/*`, counts as ignoring `gen`, and Hone reports its files as ignored where the team's `eslint .` still loads the broken `gen/eslint.config.*` and fails. A file that no `eslint.config.*` applies to stops the run the same way, and the next step is to create one at the repository root that spreads the projection, as [ADOPTING.md](ADOPTING.md) step 4a shows. Detection cannot see how a task runner starts ESLint, so `disciplines.json` can state the lookup: `"eslintConfigLookup": "nearest-to-file"` or `"repository-root"`, which overrides detection. Both lookups are tested against monorepo fixtures with a config per package.

## Compatibility

Hone's version numbers follow semantic versioning under these rules:

- A new or tightened check ships off by default in a minor release and becomes a default only in a major release.
- A change to the ESLint config that `hone project` generates, which an adopter must regenerate, is a minor release, with a clear message telling the adopter to regenerate: its changelog entry says to run `hone project` and commit the result, and until then the check reports the projection `out-of-date`.
- A change to a clause address, a config key in `disciplines.json` or `discipline-exceptions.json`, or a CLI flag is a major release.
- A breaking change to a type in `@hailstails/hone/rule-set` is a major release. `@hailstails/hone/audit` is experimental: its types may change in a minor release until it is marked stable.
- Before the first stable release, a change that would need a major release ships in a minor release instead.
- A pre-release previews the release it is numbered towards and is published under the `next` dist-tag. A change of any size can land between two pre-releases of the same release, and the changelog lists it.

Each release's changes are listed in [the changelog](https://github.com/HailsTails/hone/blob/main/CHANGELOG.md) in the repository.

## Known limits

The ESLint pieces use the plugin namespace `hone` for CD-14 and `hone-cd<N>` for the others, so a rule id reads `hone/no-class-authoring`. The namespace `hone-core` is reserved for Hone's own machinery, never a discipline's rule: it names the projection's block names, such as `hone-core/piece/hone`, and the governance rule `hone-core/inline-config`, which reports inline configuration comments. No piece may use it.

This is the first release. Its tests cover each supported platform's ordinary paths and drives, and a committed ESLint projection checked out with either LF or CRLF line endings. The cases below are not covered by tests. Some may already work, but none is supported until a consumer needs it and a test is added:

- File and folder names outside ASCII.
- Windows device paths (`\\?\C:\...`).
- Repositories or installs on a network share (`\\server\share\...`).
- Paths rooted without a drive (`\repo`).
- Drive-relative paths (`D:file`).
- A working directory that is deleted or can't be read.
- File names containing a backslash.
- A lone carriage return as a line ending.
- `.d.mts` and `.d.cts` declaration files are not handled separately from other sources.
- Columns reported on lines holding non-ASCII text.
- Lint scripts are read with a simple shell tokenizer, so unusual quoting or a `cd` before `eslint` is not interpreted.
- Detection reads an ESLint 9 run started from inside a package, or given the lookup flag through the environment or a task runner, as a root-only run; set `eslintConfigLookup` in `disciplines.json` for those repositories.
- Team ESLint configs that imitate projection block names, register a second copy of the plugin, or use processors are not exercised.
- A byte-order mark at the start of `disciplines.json` or `discipline-exceptions.json`; save them without one.

## Developing Hone

This repository is self-contained: it holds its own configuration and its own lock. `package.json` declares the packages the code imports and the development tools, `pnpm-lock.yaml` locks both, `tsconfig.json` typechecks the code under `strict`, `lint.biome.json` configures the linter, and `vitest.config.ts` runs its tests. `package.json` pins the pnpm version that locks and installs them, `pnpm-workspace.yaml` holds its settings, and pnpm resolves a dependency only to a release that is at least three days old when a dependency is added or updated; installing from the lock does not re-check it. Run `corepack enable` once so that Node provides that pnpm, install with `pnpm install --frozen-lockfile` in this directory, then run a script from it with `pnpm run <script>`:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `lint` | Biome with `lint.biome.json` |
| `test` | Vitest with `vitest.config.ts` |
| `check` | all three in that order |
| `build-package` | `node scripts/build-package.ts`: bundles Hone with esbuild from its own installed packages into `dist/`, and adds the published `package.json`, the shipped documents and data, and `THIRD-PARTY-NOTICES.md`. It fails if an output imports anything but a `node:` builtin or a declared peer, if a command or runner is not emitted at its own path with its own code, if a bundled package's version is not the one the lock holds, or if a shipped page links to a file the package does not ship. The tool's name, package name, command name, shipped rule-set name, reserved ESLint namespace, description, GitHub repository and the unrelated npm name to warn against live in `core/values/tool-identity.ts`, which the build, the install proof, the release text, the command's usage line and the ESLint runner all read. The reserved namespace is its own field, independent of the package name |
| `pack-package` | `node scripts/pack-package.ts`: builds `dist/` and packs it with `npm pack` into `artefacts/hailstails-hone-<version>.tgz`, named by the `version` in `package.json` |
| `package-determinism` | `node scripts/check-package-determinism.ts`: builds and packs twice into separate temporary roots and fails naming any file that differs, or when the two packed tarballs differ |
| `self-check` | `node scripts/self-check.ts check --repo .`: runs Hone's own check on this repository with `disciplines.json` and `discipline-exceptions.json`; pass `--base-revision <rev>` after the script name. See [Core's check on itself](#hones-check-on-itself) |
| `install-proof` | `node scripts/install-proof.ts`: packs the package once into a temporary tarball and installs it offline into six CommonJS consumers in an OS temporary directory outside the working tree, each copied from its folder under `tests/test-fixtures/consumer-proof/`, which holds only what that consumer's action needs. Each consumer exists for one thing only an installed package shows. The audit consumer, on TypeScript 4.8.4, runs `check` through the installed bin and expects its finding. The ESLint 9.28.0 and 10.0.0 consumers run `project`, expect a projection importing the piece by package name, and expect its finding from `check`. The consumer without `eslint` expects `toolchain-unavailable`. These four run with type stripping off. The team consumer is the example [docs/extending.md](docs/extending.md) follows. On TypeScript 4.8.4 it type-checks a wrong team piece, rule set and ESLint piece settings with its own `tsc`, as described under Public type entries, and expects the three errors. On the development versions, TypeScript 6.0.3, ESLint 10.11.0 and typescript-eslint 8.71.2, it also type-checks its rule set under `nodenext` and `bundler` and a CommonJS file, then runs both commands with type stripping on: its `.ts` pieces load through the installed package and give one finding from each mechanism under the team's `acme/` prefix. Its root says `"type": "commonjs"`, the hard case, so its rule set carries its own `"type": "module"` `package.json`. It installs each toolchain once, in a folder the consumers sharing it sit inside: TypeScript 4.8.4 alone for the audit consumer, the consumer without `eslint` and the team consumer on 4.8.4; ESLint 9.28.0 or 10.0.0 with typescript-eslint 8.56.0 and TypeScript 4.8.4 for the two ESLint consumers; and the development versions for the team consumer. Each consumer declares the required peer `typescript` at its pin in its own `devDependencies`, as an adopter does, and the proof checks that `typescript` resolves there at that version, since npm would otherwise install the newest supported release beside it. A pass once a violation is removed, rule-set naming, plugin namespaces, settings overrides and per-package ESLint configs are proven by unit and in-process tests instead. The temporary directory is removed afterwards |
| `pull-request-title` | `node scripts/pull-request-title-command.ts <title>`: passes a title shaped as a Conventional Commits subject, `type(scope)!: description`, and fails any other with the expected form. See [Versions and releases](#versions-and-releases) |
| `release-pull-request` | `node scripts/release-pull-request-command.ts [pre-release\|stable]`: writes the next release's section into `CHANGELOG.md` and its version into `package.json`, in the working tree only. See [Versions and releases](#versions-and-releases) |

### Hone's check on itself

`disciplines.json` selects every mechanical clause Hone ships, through the mechanism it names, confines the `eslint` package under CD-19's `confinedPackages`, and excludes `tests/test-fixtures/consumer-proof`: those folders are package-test content, the files of other repositories that `install-proof` copies out and checks with their own Hone run. `eslint.config.mjs` spreads the committed `disciplines.eslint.mjs` projection, which `node scripts/self-check.ts project --repo .` regenerates. `discipline-exceptions.json` holds eight `authorised-location` records for `CD-19#import-boundaries`, each the single file that binds a runtime or third-party surface; seven are imported, with `existing-authorisation` provenance, from the earlier records kept in `.constitution-authorised-locations/cd-19.json`, and the eighth, for `mechanisms/eslint/runner/native-rules.ts`, carries its own why-chain. Strictness lives in `tsconfig.base.json`, which `tsconfig.json` extends; `tsconfig.json` leaves the same consumer folders out, since their files compile against the installed package.

`self-check` prints Hone's full report on itself, then one `self-check:` line. It fails when the run cannot load, or when any of `uncovered`, `stale`, `forfeited`, `doublyHeld`, `invalidRecords`, `unmeasured` or `projectionProblems` holds an entry: that is, when the selection, the exception records or the projection are not sound. It does not fail on `findings` or `unrecorded`. Those are printed in full and counted in the `self-check:` line, but they do not gate a change yet: the test fixtures hold deliberate violations, and some of Hone's own code does not meet every selected clause. CI runs `self-check` on every change with the pull request's base, or the previous `main`, as the base revision.

Continuous integration runs `check`, `build-package`, `package-determinism` and `install-proof` on every pull request, drafts included, and on every push to `main`, from `pnpm-lock.yaml` alone. It runs the same steps on Windows and on Linux, and both pass. Two further jobs, `Package on Node <version> on <platform>`, are not required checks. One builds the package and runs `install-proof` on macOS with the oldest Node the package claims; the other does the same on Node 24 on Linux and also runs the test suite. The required jobs already prove the oldest claimed Node on Windows and Linux. The extra jobs show that the package installs and runs on the other platform and Node line, against the toolchain floors `install-proof` uses. A separate workflow, `pull-request-title.yml`, runs `pull-request-title` on each pull request's title whenever the pull request is opened, edited, reopened, marked ready or pushed to.

### Versions and releases

Pull requests are squash-merged, and the pull request's title becomes the commit's subject on `main`. The `pull-request-title` check requires that title to be a Conventional Commits subject: `type(scope)!: description`, where the scope is optional and lowercase, `!` marks a breaking change as [Compatibility](#compatibility) defines it, and the type is one of `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`, `test`, `build`, `ci`, `chore` or `style`. Reverting behaviour that has been released is breaking, so its title is `revert!:`; `revert:` without `!` is for undoing a change that has not been released, and counts as a patch. A title that changes the ESLint projection says that adopters must run `hone project`, since the title becomes the changelog entry. `.github/dependabot.yml` leaves Dependabot's routine version updates off and gives its security pull requests a conventional title with the type `build` and a scope, such as `build(deps):`. It covers the GitHub Actions the workflows use and, through the `npm` ecosystem, which is how Dependabot names pnpm, the JavaScript dependencies in `pnpm-lock.yaml`. A security release published in the last three days can be held back by the minimum release age when pnpm resolves it.

To prepare a release, create a new branch at the tip of `main` and run `pnpm run release-pull-request` on it before anything is committed to it. It finds the highest release tag `v<version>` merged into `HEAD`, reads the full message of every commit after it, and works out the next version. It needs that history to be the straight line of squash-merged commits that `main` holds, so it refuses, changing nothing and naming the commits, when any of them is a merge commit, since a merge brings in changes whose subjects it cannot size. It works out the version like this:

- A subject with `!`, or a message with a `BREAKING CHANGE:` or `BREAKING-CHANGE:` footer line, is a major change, `feat` a minor change, and every other subject a patch. While the major version is 0, a major change counts as a minor one, so the script never picks the first stable release: the owner prepares that release by hand, setting the version in `package.json` and writing its changelog section, and only on her word.
- On a pre-release, a change no larger than the one the pre-release is numbered towards moves to the next pre-release number; a larger one starts the next version's first pre-release. On a stable release, the change increments the version.
- The release stays on the latest tag's channel. Pass `stable` to finish a pre-release as its stable version, or `pre-release` to start a pre-release line from a stable one.

It then writes a section for that version at the top of `CHANGELOG.md`, grouping the subjects under Breaking changes, Features, Fixes and Other changes, and sets `version` in `package.json`. It refuses, changing nothing, when no subject follows the tag, when a merge commit does, when `package.json` is not at the tag's version, or when the changelog already has the new version. A subject that is not a Conventional Commits subject is named on standard error and counted as a patch under Other changes, or as a major under Breaking changes when its message has a breaking footer, so check its place before opening the pull request. If writing the second file fails, it restores the first. The script only edits those two files: it never commits, tags, pushes or publishes. Open the release pull request with the title `chore(release): <version>`.

`CHANGELOG.md` names versions, so it stays in the repository and out of the package; the shipped pages link to it on GitHub.

Once the release pull request is on `main`, a release starts from a pushed tag `v<version>` that matches the `version` in `package.json`, pushed only on the owner's word. The release workflow runs `check`, `package-determinism` and `install-proof`, packs the tarball with `pack-package`, records the tarball's name and SHA-256 as outputs of the release job, and attaches it to a GitHub release for that tag. `gh release create` creates that release as a draft, uploads the tarball and only then publishes it, so with immutable releases on, the tarball is attached before the release's assets and tag become immutable. `scripts/release-text-command.ts` prints the release's title from the identity and the tag, its notes, which name the npm install command under its dist-tag and the attached tarball but no version, and its dist-tag: `next` when the version has a pre-release part such as `-pre.1` before any `+` build metadata, otherwise `latest`. The release is marked as a pre-release exactly when its dist-tag is `next`, and the step stops if any of the three cannot be printed. The release does not wait on npm.

A version reaches npm in four steps:

1. The pushed tag creates the GitHub release, as above.
2. A second job downloads that release's tarball, refuses it unless its SHA-256 equals the one the release job recorded in the same run, and stages it with `npm stage publish` under the release job's dist-tag. A staged version is held by npm and cannot be installed. Its dist-tag is fixed when it is staged.
3. The npm owner approves it, on npmjs.com under `@hailstails/hone`, Staged Packages, or with `npm stage approve <stage-id>`. Approval needs the owner's two-factor sign-in, so CI cannot approve.
4. The version is published under its dist-tag and installable.

The second job runs in the GitHub environment `npm`, which accepts only `v*` tags, and only when the repository variable `NPM_PUBLISH` is `enabled`; with any other value, or none, it is skipped and the release is unaffected. It authenticates by npm trusted publishing, so no npm token is stored. The trusted publisher is saved on npmjs.com under `@hailstails/hone`, Settings, Trusted publishing, GitHub Actions, as: user `HailsTails`, repository `hone`, workflow filename `release.yml`, environment `npm`, with both allowed actions, "npm publish" and "npm dist-tag", unticked, so CI can only stage. The published `package.json` carries `repository`, `homepage` and `bugs` from the identity's repository, which trusted publishing matches against this repository, and `publishConfig.access` `public`, because npm otherwise publishes a scoped package as restricted. `build-package` fails if a shipped page names a versioned tarball of the package, at any version, or the version in `package.json`, with or without a leading `v`, so a page cannot name the current version and go stale on the next release.

npm does not check a trusted publisher when it is saved, and one that has not completed a successful publish within 2 days of being added expires and can no longer be used or edited. npm's documentation does not say whether a staged publish counts as that first publish, so save the trusted publisher only just before pushing a tag, and approve the staged version within the same 2 days. A re-run of an older release run stages a version npm already has, so it cannot complete that first publish.
