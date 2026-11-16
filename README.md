# Hone

Hone checks a repository against the disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Its core enforces nothing and names no discipline and no mechanism. A discipline (for example CD-14, no authored classes) is data under `rules/`, and a mechanism is a runner under `mechanisms/`; the core reaches both only through files and one module contract.

**Install the npm package `@hailstails/hone`.** The unscoped name `hone` on npm belongs to an unrelated package: never run `npm install hone`. `@hailstails/hone` installs one command, `hone`:

```bash
npm install --save-dev ./vendor/hailstails-hone/hailstails-hone-0.1.0-pre.2.tgz
```

Version `0.1.0-pre.2` is a pre-release, downloaded as `hailstails-hone-0.1.0-pre.2.tgz` from the [`v0.1.0-pre.2` GitHub release](https://github.com/HailsTails/hone/releases/tag/v0.1.0-pre.2) once that tag is pushed. The earlier [`v0.1.0-pre.1` release](https://github.com/HailsTails/hone/releases/tag/v0.1.0-pre.1) holds the previous pre-release under the package's old name, `honed`; [MIGRATING.md](MIGRATING.md#11-moving-from-honed-to-hailstailshone) says how to move from it. After the first registry publish of `@hailstails/hone`, `npm install --save-dev @hailstails/hone@next` installs the latest pre-release from npm instead. [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps, and the alternative of building the tarball from a pinned commit.

Two mechanisms ship: `audit`, a standalone TypeScript syntax walker, and `eslint`, which runs the clause as an ESLint rule inside the team's own ESLint setup. [rules/README.md](rules/README.md) lists every shared discipline with its clauses: the audit mechanism checks 20 disciplines, and ESLint pieces check clauses of CD-1, CD-6, CD-7, CD-10, CD-14, CD-27, CD-40, CD-41, CD-42 and CD-44. The rest are judgement rules, applied in review with the review methods in [methods/](methods/README.md).

To adopt Hone in another repository, follow [ADOPTING.md](ADOPTING.md) step by step. A repository already using the older standalone route, or a copy of Hone's source, follows [MIGRATING.md](MIGRATING.md) instead.

Adding a discipline or a mechanism, and the full list of ESLint native channels, are covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

The package ships one command, `hone`, with two subcommands, run through a `package.json` script as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) shows:

```text
hone check --repo <dir> [--base-revision <rev>] [--report-output <output>]
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

The report lists the excluded paths, findings, exempted findings, uncovered clauses, stale, forfeited, unrecorded and doubly-held exceptions, invalid exception records, unmeasured checks and projection problems, each with its count. The verdict is `pass` only when every list except the excluded paths and exempted findings is empty.

`--report-output` sets how much of the report is printed for one run, overriding `reportOutput` in `disciplines.json`; with neither, the output is `full`.

| Output | Prints |
| --- | --- |
| `full` | every non-empty section with its entries, then the verdict |
| `failures-only` | the same without the `excluded` and `exempted` sections |
| `counts` | one `<section> (<count>)` line per non-empty section, with ` informational` after `excluded` and `exempted`, then the verdict |
| `verdict-only` | only the verdict line |

The output changes only what is printed: the verdict and exit code always come from the whole report. An unknown `--report-output` value is a load failure `arguments-invalid`; an unknown `reportOutput` value makes `disciplines.json` `file-malformed`, even when `--report-output` is given. Load failures print the same in every output.

Without `--base-revision`, Hone cannot tell which files were touched, so a file carve-out cannot be forfeited; if any file carve-out exists the report lists `forfeiture-unmeasured` and the run fails. For the same reason it cannot tell whether an entry with an earlier-contract why-chain is unchanged; if one exists the report lists `legacy-chain-unmeasured` and the run fails.

`hone project` writes the native configuration each embedded mechanism needs, and prints `<path> <effect>` per file (`written` or `unchanged`). The audit mechanism is standalone and writes nothing, so with only the walker selected the command prints nothing and exits `0`.

## Adopting the ESLint mechanism

With any clause selected for `eslint`, run `hone project`. It writes `disciplines.eslint.mjs` at the repository root: one block per piece enabling its selected rules at `"error"` on `**/*.{ts,tsx,mts,cts}`, then one block per exception record turning the rule `"off"` for that record's file, or everywhere for a clause-wide carve-out. Commit it, and spread its default export last in the repository's flat config:

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

- `ruleSets` names the repository's own rule sets, each a directory relative to the repository root. The name `shared` is reserved for the rule set shipped with core.
- `clauses` maps a clause address to a mechanism id. An address is `[<ruleSet>/]<DisciplineId>#<clauseId>`; no prefix means the shared rule set. The mechanism must be one the clause lists.
- Selecting a clause adopts its discipline. Mechanical clauses of an adopted discipline that are not selected are reported as uncovered, and fail the run.
- A judgement clause cannot be selected; it is enforced by review.
- `eslintConfigLookup`, optional, is `"nearest-to-file"` or `"repository-root"` and says which `eslint.config.*` the team's own ESLint run applies to a file; see [Runtime](#runtime). Leave it out to let Hone detect it.
- `fileExceptionWhyChains`, optional, is `"required"` (the default) or `"optional"`. `"optional"` lets an `authorised-location` or `file-carve-out` entry give only its `reason`; see [discipline-exceptions.json](#discipline-exceptionsjson).
- `reportOutput`, optional, is `"full"` (the default), `"failures-only"`, `"counts"` or `"verdict-only"`: the repository's default for how much of the report the check prints. `--report-output` overrides it for one run; see [Commands](#commands).
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

Hone installs as one npm package, `@hailstails/hone`, downloaded as `hailstails-hone-0.1.0-pre.2.tgz` from the `v0.1.0-pre.2` GitHub release once that tag is pushed, installed after the first registry publish as `@hailstails/hone@next` from npm, or built by `bun run pack-package` into `artefacts/hailstails-hone-0.1.0-pre.2.tgz`, the file name `npm pack` gives the scoped package, and added to the repository root as a development dependency; [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps. The package is plain JavaScript with `zod`, `jsonc-parser` and `@eslint/plugin-kit` bundled in, so it has no `dependencies`; its licences are reproduced in `THIRD-PARTY-NOTICES.md` inside it. It declares the toolchain as `peerDependencies`, `typescript` required and the ESLint packages optional, and exposes one command, `hone`, whose subcommands `hone check` and `hone project` are described under Commands. It ships the rule data and pages, both mechanisms, the review methods and the why-chain contract, and no TypeScript source. Version `0.1.0-pre.2` is a pre-release.

With the ESLint mechanism selected, a packaged install's projection imports each piece by package name, `@hailstails/hone/mechanisms/eslint/<DisciplineId>/...`, so the repository's ESLint must resolve the package from the repository root. Hone compares the committed projection `disciplines.eslint.mjs` byte for byte with what `hone project` would write now.

## Runtime

- Windows, Linux, macOS or WSL. Hone keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them.
- The package: Node `^22.13.0 || >=24` (its `engines.node`). It is plain JavaScript, so Node never strips types from it.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- Hone's own packages, `zod`, `jsonc-parser` and `@eslint/plugin-kit`, exact-pinned in `dependencies` and locked by `bun.lock`: bundled into the package. They are implementation details: nothing of theirs crosses into the repository's code or configuration.
- The repository's own toolchain, declared as `peerDependencies`: `typescript` `>=4.8.4 <7.0.0`, a required peer because every audit clause needs it, and for the ESLint mechanism the optional peers `eslint` `^9.12.0 || ^10.0.0`, `@typescript-eslint/parser` `^8.56.0` and `@typescript-eslint/eslint-plugin` `^8.56.0`. npm 7 and later install a missing required peer on their own, so declare `typescript` at the root at the version the repository uses. Each floor is the oldest release Hone is tested on: TypeScript 4.8 is the oldest whose syntax API the audit uses (`getModifiers`), ESLint 9.12.0 the first 9.x that can look up the configuration nearest each file, and typescript-eslint 8.56.0 the first whose peer range accepts ESLint 10. TypeScript stops below 7 because TypeScript 7's compiler API is a different one. Yarn Plug'n'Play is not supported.

Hone loads the toolchain by Node's own resolution, upward from the install directory, which is the same resolution the pieces' plugin modules get when the team's ESLint loads the projection. Hone's query of the team's configuration, its governance run and the pieces therefore all use one copy, the repository's. Keep the toolchain resolvable from the repository root: declare it in the root `package.json` (in a pnpm workspace, `pnpm add -Dw`). A package may install a different ESLint for its own lint script; Hone's verdict still comes from the root's, its governance behaviour is the same on either supported line, and the pieces that wrap native rules wrap the root's copies there too. Hone's tests run the governance path and every piece's shared cases on four ESLint lines, 9.12.0 and 10.0.0 with typescript-eslint 8.56.0 and 9.39.5 and 10.11.0 with 8.71.2, and the audit pieces' shared cases on TypeScript 4.8.4 and 6.0.3; the in-process consumer fixtures run on ESLint 10.11.0, and `install-proof` runs real consumers on each floor.

A peer that is missing, cannot load, or is outside its range stops the mechanism before any piece loads, with one line such as `load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.12.0 || ^10.0.0: add a supported version to the devDependencies of the repository root`. A missing `typescript` is reported the same way, with the line saying that `typescript` is a required peer of `@hailstails/hone` and the install is incomplete, since a supported install always has it. A peer that resolves from inside the installed package, such as an `eslint` left in `node_modules/@hailstails/hone/node_modules`, stops it as `toolchain-shadowed`, naming where it resolved and the folder to delete before reinstalling core. A source checkout of Hone is its own development install, so its development toolchain in its own `node_modules` is not a shadow.

A repository can hold one `eslint.config.*` at its root or one per package. Hone resolves the team's configuration the way the team's own ESLint run does. ESLint 10, and ESLint 9 started with `--flag v10_config_lookup_from_file` (or `unstable_config_lookup_from_file`), use the `eslint.config.*` nearest each checked file. Plain ESLint 9 uses only the one in the directory it runs from, so for a repository whose `eslint` resolves to 9.x at `node_modules/eslint` and whose lint scripts carry no such flag, Hone reads the root `eslint.config.*` for every file, and fails the run as `team-config-unloadable` if there is none. When Hone cannot read an installed `eslint` at the repository root it assumes the nearest-to-file lookup. Each config that applies to a file must spread the projection. Detection cannot see how a task runner starts ESLint, so `disciplines.json` can state the lookup: `"eslintConfigLookup": "nearest-to-file"` or `"repository-root"`, which overrides detection. Both lookups are tested against monorepo fixtures with a config per package.

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

This repository is self-contained: it holds its own configuration and its own lock. `package.json` declares the packages the code imports and the development tools, `bun.lock` locks both, `tsconfig.json` typechecks the code under `strict`, `lint.biome.json` configures the linter, and `vitest.config.ts` runs its tests. Install with `bun install --frozen-lockfile` in this directory, then run a script from it:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `lint` | Biome with `lint.biome.json` |
| `test` | Vitest with `vitest.config.ts` |
| `check` | all three in that order |
| `build-package` | `node scripts/build-package.ts`: bundles Hone with esbuild from its own installed packages into `dist/`, and adds the published `package.json`, the shipped documents and data, and `THIRD-PARTY-NOTICES.md`. It fails if an output imports anything but a `node:` builtin or a declared peer, if a command or runner is not emitted at its own path with its own code, if a bundled package's version is not the one the lock holds, or if a shipped page links to a file the package does not ship. The tool's name, package name, command name, reserved ESLint namespace, description, GitHub repository and the unrelated npm name to warn against live in `core/values/tool-identity.ts`, which the build, the install proof, the release text, the command's usage line and the ESLint runner all read. The reserved namespace is its own field, independent of the package name |
| `pack-package` | `node scripts/pack-package.ts`: builds `dist/` and packs it with `npm pack` into `artefacts/hailstails-hone-<version>.tgz`, named by the `version` in `package.json` |
| `package-determinism` | `node scripts/check-package-determinism.ts`: builds and packs twice into separate temporary roots and fails naming any file that differs, or when the two packed tarballs differ |
| `self-check` | `node scripts/self-check.ts check --repo .`: runs Hone's own check on this repository with `disciplines.json` and `discipline-exceptions.json`; pass `-- --base-revision <rev>`. See [Core's check on itself](#hones-check-on-itself) |
| `install-proof` | `node scripts/install-proof.ts`: packs the package once into a temporary tarball and installs it offline into four CommonJS consumers in an OS temporary directory outside the working tree: the audit on TypeScript 4.8.4, ESLint 9.12.0, ESLint 10.0.0, and one without `eslint`. It installs each toolchain once, at the peers' floors, in a folder the consumers sharing it sit inside: TypeScript 4.8.4 alone for the audit consumer and the consumer without `eslint`, and ESLint 9.12.0 or 10.0.0 with typescript-eslint 8.56.0 and TypeScript 4.8.4 for the two ESLint consumers. Each consumer declares the required peer `typescript` at its floor in its own `devDependencies`, as an adopter does, and the proof checks that `typescript` resolves there at 4.8.4, since npm would otherwise install the newest supported release beside it. Each consumer runs both commands through the installed bins with type stripping off, expecting a fail on a class, a pass once it is removed, a projection importing each piece by package name, and `toolchain-unavailable` for the consumer without `eslint`; the temporary directory is removed afterwards |

### Hone's check on itself

`disciplines.json` selects every mechanical clause Hone ships, through the mechanism it names, and `eslint.config.mjs` spreads the committed `disciplines.eslint.mjs` projection, which `node scripts/self-check.ts project --repo .` regenerates. `discipline-exceptions.json` holds seven `authorised-location` records for `CD-19#import-boundaries`, each the single file that binds a runtime or third-party surface; they are imported, with `existing-authorisation` provenance, from the earlier records kept in `.constitution-authorised-locations/cd-19.json`. Strictness lives in `tsconfig.base.json`, which `tsconfig.json` extends.

`self-check` prints Hone's full report on itself, then one `self-check:` line. It fails when the run cannot load, or when any of `uncovered`, `stale`, `forfeited`, `doublyHeld`, `invalidRecords`, `unmeasured` or `projectionProblems` holds an entry: that is, when the selection, the exception records or the projection are not sound. It does not fail on `findings` or `unrecorded`. Those are printed in full and counted in the `self-check:` line, but they do not gate a change yet: the test fixtures hold deliberate violations, and some of Hone's own code does not meet every selected clause. CI runs `self-check` on every change with the pull request's base, or the previous `main`, as the base revision.

Continuous integration runs `check`, `build-package`, `package-determinism` and `install-proof` on every pull request, drafts included, and on every push to `main`, from `bun.lock` alone. It runs the same steps on Windows and on Linux, and both pass.

A release starts from a pushed tag `v<version>` that matches the `version` in `package.json`. The release workflow runs `check`, `package-determinism` and `install-proof`, packs the tarball with `pack-package`, records the tarball's name and SHA-256 as outputs of the release job, and attaches it to a GitHub release for that tag. `gh release create` creates that release as a draft, uploads the tarball and only then publishes it, so with immutable releases on, the tarball is attached before the release's assets and tag become immutable. `scripts/release-text-command.ts` prints the release's title and notes from the identity, and its dist-tag: `next` when the version has a pre-release part such as `-pre.1` before any `+` build metadata, otherwise `latest`. The release is marked as a pre-release exactly when its dist-tag is `next`, and the step stops if any of the three cannot be printed. The release does not wait on npm.

Once the GitHub release exists, a second job downloads that release's tarball, refuses it unless its SHA-256 equals the one the release job recorded in the same run, and publishes it with `npm publish` under the release job's dist-tag. The job runs in the GitHub environment `npm`, which accepts only `v*` tags. It authenticates by npm trusted publishing, so no npm token is stored, and npm adds provenance itself. The published `package.json` carries `repository`, `homepage` and `bugs` from the identity's repository, which trusted publishing matches against this repository, and `publishConfig.access` `public`, because npm otherwise publishes a scoped package as restricted. The job runs only when the repository variable `NPM_PUBLISH` is `enabled`; with any other value, or none, it is skipped and the release is unaffected. `build-package` fails if a shipped page names the tarball at a version other than the one in `package.json`.

Turning on npm publishing takes three steps, in this order:

1. Push the tag `v0.1.0-pre.2` with `NPM_PUBLISH` unset, so the release workflow creates the release and skips npm. Then publish `@hailstails/hone` once by hand from that release's tarball: download it with `gh release download v0.1.0-pre.2 --repo HailsTails/hone --pattern 'hailstails-hone-*.tgz'`, sign in with `npm login` as the npm user `hailstails`, who owns the `@hailstails` scope (npm refuses a scoped publish from any other user), and run `npm publish ./hailstails-hone-0.1.0-pre.2.tgz --tag next --access public`. The earlier `v0.1.0-pre.1` release's tarball can never be published: it names the package `honed`, which npm refuses as too similar to existing packages.
2. Only just before pushing the tag after `v0.1.0-pre.2`, add the trusted publisher on npmjs.com, under `@hailstails/hone`, Settings, Trusted publishing, GitHub Actions: user `HailsTails`, repository `hone`, workflow filename `release.yml`, environment `npm`. Then set `NPM_PUBLISH` to `enabled`, under Settings, Secrets and variables, Actions, Variables, or with `gh variable set NPM_PUBLISH --body enabled --repo HailsTails/hone`. npm does not check the trusted publisher when it is saved, and one that has not completed a successful publish within 2 days of being added expires and can no longer be used or edited.
3. Push that next tag. Its release run is the only thing that publishes from CI: re-running an older release run tries to publish a version npm already has, so it cannot complete the trusted publisher's first publish.
