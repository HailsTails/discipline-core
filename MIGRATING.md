# Migrating from the standalone copy route

This page moves a repository from the older standalone route, which copied rule files into a harness folder and wired selected linter rules by hand, to Hone. Follow the steps in order. Every command is run from the repository root. Stop at any "stop and ask" line and hand the question to the human; do not guess past it.

A repository already on Hone, or on discipline Hone before the rename, whose exceptions predate causal why-chains needs only [section 8](#8-moving-to-causal-why-chains).

## 1. Detect the old install

Look for each of these and write down what you find:

| What | Where | Example |
| --- | --- | --- |
| Copied rule files | `.claude/`, `.codex/` or `.cursor/` under `knowledge/aidlc-shared/code-discipline/` | `.cursor/knowledge/aidlc-shared/code-discipline/cd-001-no-any.md` |
| Copied guides | the same folder | `standalone-adoption.md`, `standalone-cd-inventory.md`, `standalone-linter-options.md` |
| Copied tools tree | `.claude/tools/`, `.codex/tools/` or `.cursor/tools/` | `.cursor/tools/rin-harness-constitution-audit.ts` |
| Tool config | repository root | `harness.config.json` |
| Debt records | repository root | `.constitution-carve-outs/cd-<id>.json` |
| Structural records | repository root | `.constitution-authorised-locations/cd-<id>.json` |
| Hand-written linter rules | `biome.json`, `eslint.config.*`, `.oxlintrc.json` | `noExplicitAny`, `@typescript-eslint/no-explicit-any`, `typescript/no-explicit-any` |
| Compiler flags | every `tsconfig*.json` | the seven CD-3 flags |
| Scripts and hooks | `package.json` scripts, CI workflow, pre-push hook | `bun .cursor/tools/rin-harness-constitution-audit.ts`, `rin-harness-carve-out-decay.ts`, `rin-harness-hermetic-git-guard.ts` |
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, an adoption record | "read the selected discipline files before editing" |

The chosen disciplines are the `cd-NNN-*.md` files that were copied (CD-1, CD-3 and CD-46 in the old quick start), plus any CD named in a record file.

A CD that a record file names but whose rule file was not copied (for example CD-15, when only CD-1, CD-3 and CD-46 were copied) is expected: select it in step 2 like the others. Stop and ask the human only if a named CD is one of CD-35 to CD-38.

Old code often holds CD-1 `any` the old route never checked. Hone flags it in step 3; it is new debt, so fix it or record it only after the human approves (step 3), and any further `any` still fails.

## 2. Install Hone and select the clauses

Do [ADOPTING.md](ADOPTING.md) steps 1, 2 and 4 (and 4a for any `eslint` clause). A repository that used only Biome has no `eslint.config.*`: create `eslint.config.mjs` as step 4a shows before the first check, or the check stops with `runner-failed eslint team-config-unloadable`. Leave the old files in place until step 6.

Map each chosen discipline to its clauses with this table. A discipline is adopted whole: select every mechanical clause it lists, or the check reports the rest as `uncovered`.

| Old CD | Clauses to select in `disciplines.json` |
| --- | --- |
| CD-1 | `CD-1#any-cast` audit, `CD-1#explicit-any` eslint, `CD-1#implicit-any-let` eslint |
| CD-3 | all seven `CD-3#...` clauses, audit; then move the flags out of `tsconfig.json` (step 4) |
| CD-46 | nothing to select: it applies to every file carve-out once the check runs with `--base-revision` |
| CD-16, CD-20, CD-24 | select their owners, CD-15, CD-19 and CD-23 |
| CD-35, CD-36, CD-37, CD-38 | not in Hone; keep their current handling |
| any other CD | every mechanical clause in `node_modules/@hailstails/hone/rules/<ID>/README.md`'s Clauses table, with a mechanism that table lists |

Clauses whose mechanism is `review` are judgement clauses: do not put them in `disciplines.json`; list them in the agent instructions instead (step 6).

Stop and ask the human if a chosen CD is one of CD-35 to CD-38, or if selecting a whole discipline adds clauses the old route never checked and the first run shows findings for them: they decide whether to fix those findings, carve them out (step 3), or not adopt that discipline yet.

## 3. Convert the old records into exceptions

Run the check once with no exceptions file, to see what Hone finds:

```bash
npm run --silent hone:check
```

CD-3 findings on `tsconfig.json` are fixed in step 4, not recorded. Then write `discipline-exceptions.json` from the old records, using the format in [README.md](README.md#discipline-exceptionsjson):

An old record file is a JSON array of entries, each listing one or more files:

```json
[
  {
    "files": ["src/legacy.ts", "src/legacy-report.ts"],
    "reason": "Inherited for...of totals loop from the 2025 pricing import",
    "decision": "Initial adoption inventory accepted by pricing owner Sam on 2026-09-02; retire on touch"
  }
]
```

- Each file in a `.constitution-carve-outs/cd-<id>.json` entry that Hone now flags becomes one `file-carve-out`: `clause` is the clause the finding names (for example `CD-15#loops`), `file` is the exact path. Two flagged files in one entry become two records with the same `source`.
- Each file in a `.constitution-authorised-locations/cd-<id>.json` entry that Hone now flags becomes one `authorised-location`.
- A listed file Hone does not flag gets no record: a record that exempts nothing is reported `stale` and fails the run.
- A finding in a file no old record lists is new debt: fix it, or record it only after the human approves.

Each converted record is imported: give it `provenance` naming the old record instead of a `whyChain`, and keep the old `reason`:

```json
{
  "kind": "file-carve-out",
  "clause": "CD-15#loops",
  "file": "src/legacy.ts",
  "reason": "Inherited for...of totals loop from the 2025 pricing import",
  "provenance": {
    "kind": "inherited-debt",
    "source": ".constitution-carve-outs/cd-15.json#0",
    "decision": "Initial adoption inventory accepted by pricing owner Sam on 2026-09-02; retire on touch"
  }
}
```

`source` is the old file and the entry's position in its array, counting from `0`, so both files in the example above use `.constitution-carve-outs/cd-15.json#0`. An authorised location uses `{ "kind": "existing-authorisation", "source": ".constitution-authorised-locations/cd-<id>.json#<index>" }`. Hone accepts an imported record only while the `--base-revision` holds it unchanged or its `source` entry lists the record's file at that revision, so keep the old record files committed until step 6, and run every check in this migration with `--base-revision HEAD`. A record you write for new debt, or an imported record you later change, needs a full `whyChain` that follows the [why-chain contract](docs/why-chain-contract.md): Hone refuses it as `import-unverified` otherwise. A repository whose `disciplines.json` sets `"fileExceptionWhyChains": "optional"` may instead give such an `authorised-location` or `file-carve-out` only its `reason`, with no `whyChain` and no `provenance`.

Stop and ask the human if an old record has no `decision`. Never write a placeholder or a root cause that only says the check was failing: Hone refuses those as `invalidRecords`.

## 4. Replace the hand-written linter rules

The ESLint projection from step 2 now carries every `eslint` clause. Remove only the rules the old route added for the disciplines; keep every other rule the repository uses:

- `biome.json`: remove `suspicious.noExplicitAny` and `suspicious.noImplicitAnyLet`. If nothing else in the file was added for the trial, remove the file, the `@biomejs/biome` dev dependency the old quick start installed and the `package.json` script that ran `biome lint` (step 6 replaces it); otherwise keep it for its other rules.
- `eslint.config.*`: remove `@typescript-eslint/no-explicit-any` (and any other rule the old route added for a CD), and spread the projection last as [ADOPTING.md](ADOPTING.md#4a-set-up-eslint-for-eslint-clauses) shows.
- `.oxlintrc.json`: remove `typescript/no-explicit-any`; remove the file if it held nothing else.
- CD-3: Hone flags any of the seven strict flags written in a file named `tsconfig.json`, even when it is `true`, because the flags must be inherited, never set per project. Move them from every `tsconfig.json` into one shared base file with another name, for example `tsconfig.base.json`, and make each `tsconfig.json` extend it (`"extends": "./tsconfig.base.json"`). Keep every other compiler option where it is. Then run the repository's own typecheck, which must still pass.

Then re-run `hone:project` and the check. With any `file-carve-out` recorded, pass `--base-revision`: without it Hone cannot tell whether a carved file was touched, reports `forfeiture-unmeasured` and fails. Locally, `HEAD` measures what is already committed:

```bash
npm run --silent hone:project
npm run --silent hone:check -- --base-revision HEAD
```

Stop and ask the human if a rule you are about to remove was there before the trial, or if you cannot tell which rules the trial added (the adoption record or `git log -p -- biome.json` usually says).

## 5. Prove the migration

Prove one failure per mechanism, then the correction. Create these two files, stage them (only tracked files are checked), and run the check with `--base-revision HEAD`:

```ts
// src/discipline-probe-loop.ts
export const probeTotal = (prices: readonly number[]): number => {
  let sum = 0;
  for (const price of prices) {
    sum += price;
  }
  return sum;
};
```

```ts
// src/discipline-probe-any.ts
export const probeValue: any = 1;
```

```bash
git add src/discipline-probe-loop.ts src/discipline-probe-any.ts
npm run --silent hone:check -- --base-revision HEAD
```

It must print a `CD-15#loops audit` finding and a `CD-1#explicit-any eslint` finding, then `verdict: fail`, and exit `1`. Use a selected clause in place of either if the repository did not adopt CD-15 or CD-1. Then remove both files (`git rm -f src/discipline-probe-loop.ts src/discipline-probe-any.ts`) and run the check again: it must print `verdict: pass` and exit `0`.

To see debt decay, change one line in a carved file, stage it and run the check: the record moves to `forfeited` and the run fails. Restore the file afterwards (`git restore --staged --worktree <file>`).

Stop here, do not remove anything, and ask the human if the check does not pass.

## 6. Remove the old route and repoint everything

Only after step 5 passes:

1. Delete the copied rule files and guides from step 1's harness folder (`.cursor/knowledge/aidlc-shared/code-discipline/` or its `.claude`/`.codex` equivalent).
2. Delete the copied tools tree and `harness.config.json`, unless anything else in the repository uses them. A repository that also runs the rin AIDLC plugin keeps `harness.config.json`, and in this same change sets `"constitution": { "engine": "discipline-core", "baseRevision": "origin/main" }` in it. Otherwise rin's stage gate, sensors and review lenses keep running the old walker over the old records, and they refuse what this check passes. Set `baseRevision` whenever a file carve-out or an imported entry exists.
3. Delete `.constitution-carve-outs/` and `.constitution-authorised-locations/`: their content now lives in `discipline-exceptions.json`.
4. In `package.json` scripts, CI and the pre-push hook, replace the old tool commands with the Hone check, as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows. Every run needs `--base-revision` while a file carve-out exists, unless it leaves forfeiture to another run as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows: in local scripts and the pre-push hook use the branch's base (`origin/main`, or `HEAD` to measure only uncommitted changes); in CI use the pull request's base commit.
5. Rewrite the agent instructions to point at `node_modules/@hailstails/hone/rules/` and the judgement rules, as ADOPTING step 5 and step 9 say, and remove any instruction to read the old copied files.
6. Run the check and the repository's own validation command again, then commit everything in one change.

Stop and ask the human if anything outside the old trial uses the copied tools or `harness.config.json`.

## 7. Known differences

| | Old route | Hone |
| --- | --- | --- |
| What is installed | rule text only; checks were the repository's own linters, plus an optional copied tools tree | one package that runs every selected check |
| Selection | whole CD files, read by an agent; a check ran only if wired by hand | clauses in `disciplines.json`; every mechanical clause of an adopted discipline must be selected |
| First-adoption debt | inherited debt could be recorded without a why-chain | imported with `provenance` and no `whyChain`, accepted only while unchanged since `--base-revision`; new or edited exceptions need a causal five-step `whyChain` ([contract](docs/why-chain-contract.md)), unless `disciplines.json` sets `"fileExceptionWhyChains": "optional"`, which lets file-level exceptions give only a `reason` |
| CD-1 | no exemptions | exempted like every other discipline, so existing `any` debt can be recorded |
| CD-3 flags | merged into the shared `compilerOptions`, wherever they were | set only in a base file not named `tsconfig.json`; any of the seven in a `tsconfig.json` is a finding |
| Running with debt | the decay check needed a base ref | every run with a file carve-out needs `--base-revision`, unless it sets forfeiture `elsewhere` |
| Debt decay (CD-46) | optional `rin-harness-carve-out-decay.ts` run | built into every check run with `--base-revision` |
| Stale and unrecorded exceptions | not checked | fail the run, including linter ignores or disables with no record |
| Path matching | old tools matched records by path suffix | exact repository paths |
| Linter | Biome, ESLint or oxlint for explicit `any` only | ESLint through the generated projection; Biome and oxlint are not Hone mechanisms |
| CD-8 exhaustive switch | typed ESLint `switch-exhaustiveness-check` suggested | the audit's `switch-defaults` clause only; type-aware linting is not supported |
| Judgement rules | read by an agent on request | each rule page names a review lens in `methods/lenses/`; ADOPTING step 9 is the procedure |

## 8. Moving to causal why-chains

An install from before the [why-chain contract](docs/why-chain-contract.md) holds chains with `whys`, `rootCause` and `owner` only. Hone still accepts such a chain while `--base-revision` holds its entry unchanged, but the first run without a base revision reports `legacy-chain-unmeasured` and fails. Do these steps in order:

1. **Give every check a base revision, before you refresh Hone.** Add `--base-revision` to the check command in `package.json` scripts, CI and the pre-push hook: `origin/main` locally, the pull request's base commit in CI. On a push to the main branch, the base is the commit before the push. Make sure CI fetches enough history to reach the base: `actions/checkout` defaults to one commit, so set `fetch-depth: 0` or fetch the base explicitly. A rin consumer on the `discipline-core` engine sets `constitution.baseRevision` in `harness.config.json`. Rin's stage gate and `disciplines` sensor pass it on.
2. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) step 10 says, and run the check. Every chain that is unchanged since the base passes. If the run lists `legacy-chain-unmeasured`, step 1 is missing somewhere. Any `why-chain-refused` entry is a legacy chain that is new or edited since the base.
3. **Rewrite each chain when you next touch its entry.** An edited entry with a legacy chain is refused until the chain follows the contract. Write the chain from the symptom down: ask why the exception exists, then ask why that answer is true, four more times. Add the `rootCheck` you ran today and the `readback`.
4. **Queue a rewrite of the rest.** Nothing ends the grace period: a legacy chain whose entry is never touched stays accepted. To make every chain causal, rewrite the remaining ones as tracked work. Rewriting a chain is an edit, so each rewritten chain must pass the contract in that change.

## 9. Moving from a copied source tree to the package

Hone is no longer installed by copying its source into the repository: this version ships no install files for that route. A copy of the source in `tools/discipline-core/` moves to the package, which gives the same reports from the same `disciplines.json` and `discipline-exceptions.json`, and runs on the repository's own toolchain. To move:

1. **Make sure the toolchain resolves from the repository root**, in the ranges [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 lists: TypeScript 4.8.4 up to 6.x, ESLint 9.28.0 or later on 9 or any 10, and typescript-eslint 8.56.0 or later on 8. Keep the versions the repository already uses.
2. **Install the package** as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says, including the two `hone:` scripts.
3. **Repoint every command.** In scripts, CI and the pre-push hook, replace `node tools/discipline-core/core/check/check-command.ts --repo .` with `npm run --silent hone:check` (pass flags after `--`, as in `npm run --silent hone:check -- --base-revision origin/main`), and `project-command.ts` with `npm run --silent hone:project`. Point agent instructions at `node_modules/@hailstails/hone/rules/`.
4. **Remove the copy.** Delete `tools/discipline-core/`, its line in `.gitignore`, and its entry in `disciplines.json`'s `exclude`.
5. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection now imports each piece by package name instead of by a path into `tools/discipline-core/`, so it changes once; commit it.
6. **Run the check.** It must give the same report as the last run on the copy. A `toolchain-unavailable` load failure names a package to install at the repository root.

## 10. Moving from the discipline-core names to Hone

Before `0.1.0-pre.1` the tool was called discipline core, with provisional names. Its npm package was then named `honed` until `0.1.0-pre.2` renamed it `@hailstails/hone`, as section 11 describes; a repository still on discipline core moves straight to the current names below. Only the names changed: the checks, the reports, the flags and the exit codes are the same, and `disciplines.json`, `discipline-exceptions.json`, `disciplines.eslint.mjs` and every `CD-*` clause address keep their names. To move:

| Old name | New name |
| --- | --- |
| npm package `discipline-core` | npm package `@hailstails/hone` (not the unscoped `hone`, an unrelated npm package) |
| tarball `discipline-core-<version>.tgz` | tarball `hailstails-hone-<version>.tgz` |
| command `discipline-core-check --repo .` | `hone check --repo .` |
| command `discipline-core-project --repo .` | `hone project --repo .` |
| scripts `discipline:check`, `discipline:project` | scripts `hone:check`, `hone:project` |
| source entries `core/check/check-command.ts`, `core/check/project-command.ts` | `core/check/tool-command.ts check`, `core/check/tool-command.ts project` |
| ESLint rule ids `discipline/<rule>` (CD-14) | `hone/<rule>` |
| ESLint rule ids `discipline-cd<N>/<rule>` | `hone-cd<N>/<rule>` |
| reserved ESLint namespace `discipline-core` (projection block names, `discipline-core/inline-config`) | `hone-core` (`hone-core/piece/...`, `hone-core/inline-config`) |
| rule pages under `node_modules/discipline-core/rules/` | `node_modules/@hailstails/hone/rules/` |

1. **Swap the package.** Run `npm uninstall discipline-core`, then install `@hailstails/hone` as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says. Replace the vendored tarball file if the repository keeps one.
2. **Rename the scripts and repoint their callers.** In `package.json`, replace the two scripts with `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."`, then change every caller of the old scripts or commands: CI, the pre-push hook and the validation script. Flags are unchanged and still go after `--`.
3. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection's imports, block names and rule ids change once; commit it.
4. **Rename old rule ids written by hand.** Any `eslint-disable` comment, team config rule entry or suppression that names `discipline/...` or `discipline-cd<N>/...` now names a rule that no longer exists. The check does not list it: it names no selected rule, so it drops out of `unrecorded` instead of appearing there. What appears is the finding it no longer suppresses, in the repository's own ESLint run. Search the repository for `discipline/` and `discipline-cd` and rename each to `hone/...` or `hone-cd<N>/...`, so the check governs it again.
5. **Repoint agent instructions** from `node_modules/discipline-core/rules/` to `node_modules/@hailstails/hone/rules/`.
6. **Run the check.** It must give the same report as the last run under the old names.

A repository whose own tooling calls the commands, such as the rin harness on the `discipline-core` engine, changes those calls on its own side. The engine name in `harness.config.json` belongs to that tooling and is not renamed here.

## 11. Moving from `honed` to `@hailstails/hone`

Version `0.1.0-pre.1` was published as the GitHub release tarball `honed-0.1.0-pre.1.tgz`, under the npm package name `honed`. npm refuses that name as too similar to existing packages, so from `0.1.0-pre.2` the package is the scoped `@hailstails/hone`, and `honed` will never be on the registry. The package name and what derives from it changed, and so did Hone's reserved ESLint namespace, from `honed` to `hone-core`, so that no name is left from the old package. The command is still `hone`, the scripts `hone:check` and `hone:project`, and the disciplines' ESLint rule ids `hone/...` and `hone-cd<N>/...`, as are `disciplines.json`, `discipline-exceptions.json` and every `CD-*` clause address.

| `honed` 0.1.0-pre.1 | `@hailstails/hone` |
| --- | --- |
| npm package `honed` | npm package `@hailstails/hone` |
| tarball `honed-<version>.tgz` | tarball `hailstails-hone-<version>.tgz` |
| projection imports `honed/mechanisms/eslint/...` | `@hailstails/hone/mechanisms/eslint/...` |
| projection block names `honed/piece/...` and the other `honed/...` blocks | `hone-core/piece/...` and `hone-core/...` |
| governance rule `honed/inline-config` | `hone-core/inline-config` |
| rule pages under `node_modules/honed/rules/` | `node_modules/@hailstails/hone/rules/` |

1. **Swap the package.** Run `npm uninstall honed`, then install `@hailstails/hone` as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says: `npm install --save-dev @hailstails/hone@next`, or the tarball attached to the latest [GitHub release](https://github.com/HailsTails/hone/releases). Remove the vendored `honed-0.1.0-pre.1.tgz` if the repository keeps one, or replace it with the new tarball. `typescript` is now a required peer, where `honed` declared it optional: if the repository root does not already declare it, npm 7 and later install the newest supported release on their own, so add it to `devDependencies` at the version the repository uses.
2. **Re-project straight away** if any clause is `eslint`, before the check, the linter or anything else runs: `npm run --silent hone:project`, then commit `disciplines.eslint.mjs`. Until then the committed projection still imports `honed/...`, which is no longer installed, so the repository's own ESLint cannot load its configuration and the check stops with `load failure: runner-failed eslint team-config-unloadable Cannot find package 'honed' imported from ...disciplines.eslint.mjs` and exit 2. `hone project` does not load the old projection, so it runs and repairs it. Its import specifiers change from `honed/...` to `@hailstails/hone/...`, and its block names from `honed/...` to `hone-core/...`, in that same re-projection. The disciplines' rule ids `hone/...` and `hone-cd<N>/...` stay, so an `eslint-disable` comment, team config entry or suppression needs renaming only if it names `honed/inline-config`, which is now `hone-core/inline-config`.
3. **Keep the scripts.** `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."` work unchanged, because the command is still `hone`.
4. **Repoint agent instructions** from `node_modules/honed/rules/` to `node_modules/@hailstails/hone/rules/`.
5. **Run the check.** It must give the same report as the last run under `honed`.
