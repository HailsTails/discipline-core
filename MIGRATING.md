# Migrating from the standalone copy route

This page moves a repository from the older standalone route, which copied rule files into a harness folder and wired selected linter rules by hand, to Hone. Follow the steps in order. Every command is run from the repository root. Stop at any "stop and ask" line and hand the question to the human; do not guess past it.

A repository already on Hone, or on discipline Hone before the rename, whose exceptions predate causal why-chains needs only [section 8](#8-moving-to-causal-why-chains). One that wants its records kept in a file for each rule and kind needs only [section 16](#16-moving-to-the-split-layout).

## 1. Detect the old install

Look for each of these and write down what you find:

| What | Where | Example |
| --- | --- | --- |
| Copied rule files | `.claude/`, `.codex/` or `.cursor/` under `knowledge/aidlc-shared/code-discipline/` | `.cursor/knowledge/aidlc-shared/code-discipline/cd-001-no-any.md` |
| Copied guides | the same folder | `standalone-adoption.md`, `standalone-cd-inventory.md`, `standalone-linter-options.md` |
| Copied tools tree | `.claude/tools/`, `.codex/tools/` or `.cursor/tools/` | `.cursor/tools/rin-harness-constitution-audit.ts` |
| Tool config | repository root | `harness.config.json` |
| Settings in the tool's own code | the copied tools tree, or rin's walker | a list of confined packages, or of files it skips (step 2a) |
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

Do [ADOPTING.md](ADOPTING.md) steps 1, 2 and 4 (and 4a for any `eslint` clause). A repository that used only Biome has no `eslint.config.*`. If it selects any clause through `eslint`, create `eslint.config.mjs` as step 4a shows before the first check, or the check stops with `runner-failed eslint team-config-unloadable`. If it lists every ESLint clause as `"not-run"` or `"not-adopted"`, it needs no ESLint config and no ESLint installed. Leave the old files in place until step 6.

Map each chosen discipline to its clauses with this table. A discipline is adopted whole: select every mechanical clause it lists, or the check reports the rest as `uncovered`. Where the rule binds but a clause's mechanism cannot work in this repository, such as an ESLint-only clause with no ESLint installed, list that clause as `"not-run"`; where the rule does not apply at all, list it as `"not-adopted"`. [ADOPTING.md](ADOPTING.md#4-write-disciplinesjson) step 4 sets out the clause values and the three declared states.

| Old CD | Clauses to select in `disciplines.json` |
| --- | --- |
| CD-1 | `CD-1#any-cast` audit, `CD-1#explicit-any` eslint, `CD-1#implicit-any-let` eslint |
| CD-3 | all seven `CD-3#...` clauses, audit; then move the flags out of `tsconfig.json` (step 4) |
| CD-46 | nothing to select: it applies to every file carve-out once the check runs with `--base-revision` |
| CD-16, CD-20, CD-24 | select their owners, CD-15, CD-19 and CD-23 |
| CD-35, CD-36, CD-37, CD-38 | not in Hone; keep their current handling |
| any other CD | every mechanical clause in `node_modules/@hailstails/hone/rules/<ID>/CHECKS.md`'s Clauses table, with a mechanism that table lists |

Clauses whose mechanism is `review` are judgement clauses: do not put them in `disciplines.json`; list them in the agent instructions instead (step 6).

Stop and ask the human if a chosen CD is one of CD-35 to CD-38, or if selecting a whole discipline adds clauses the old route never checked and the first run shows findings for them: they decide whether to fix those findings, carve them out (step 3, where `hone record-debt` can write the records), or not adopt that discipline yet.

### 2a. Carry over the old route's settings

Do this before step 3, and before you delete any record Hone lists as `stale`. The old tool kept settings in `harness.config.json` and in its own code, and Hone reads neither. A setting left behind stops a boundary being checked without any finding to show it: the old records for it exempt nothing, Hone lists them as `stale`, and deleting them drops the boundary.

| Old route | Where to look | In Hone |
| --- | --- | --- |
| Packages confined to wrapping files | a list in the tool's code or its config. Rin's walker holds it as `BANNED_THIRD_PARTY_IMPORTS`: search its tools folder for that name, since an installed copy keeps it in `constitution-audit/audit-constitution.runtime.js`, and its `audit-constitution.ts` only re-exports that file | `confinedPackages` for `CD-19#import-boundaries` under `clauseSettings` in `disciplines.json`. Hone confines no package by default, so until you list them CD-19 flags only `node:` imports. A package covers its subpaths, as [rules/CD-19/CHECKS.md](rules/CD-19/CHECKS.md#what-the-check-flags) says, where the old walker matched each listed name exactly, so Hone can flag a subpath import the old list did not name. |
| Scope | `constitution.include` and `constitution.exclude` in `harness.config.json` | `exclude` in `disciplines.json`, as [ADOPTING.md](ADOPTING.md#4-write-disciplinesjson) step 4 says. Hone has no include list and no globs: list each folder or file outside the old scope as an exact path. |
| Rules relaxed by folder | `scriptGlobs`, `uiGlobs` or similar in `harness.config.json` | nothing. Hone has one selection for the whole repository. What those folders fail under the full rules is existing debt: fix it or record it in step 3. There is no old record to import it from, so once the human approves recording it, `hone record-debt` writes the records (step 3). Do not exclude the folders to hide it. |
| Files the tool skipped in its own code | a list such as `SELF_AUDIT_EXCLUDED_FILENAMES` | an `exclude` entry or an exception record for each file. Stop and ask the human which, and why. |

A `stale` record on `CD-19#import-boundaries` right after the move usually means the confined list was not carried over. Fix `confinedPackages` and run the check again before deleting anything.

## 3. Convert the old records into exceptions

Do step 2a first. Then run the check once with no exceptions file, to see what Hone finds:

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
- A listed file Hone does not flag gets no record: a record that exempts nothing is reported `stale` and fails the run. Before you drop one, check step 2a: a file Hone does not flag only because a setting was left behind still needs its record.
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

`source` is the old file and the entry's position in its array, counting from `0`, so both files in the example above use `.constitution-carve-outs/cd-15.json#0`. An authorised location uses `{ "kind": "existing-authorisation", "source": ".constitution-authorised-locations/cd-<id>.json#<index>" }`. Hone accepts an imported record only while the `--base-revision` holds it unchanged or its `source` entry lists the record's file at that revision, so keep the old record files committed until step 6, and run every check in this migration with `--base-revision HEAD`. An imported record you later change needs a full `whyChain` that follows the [why-chain contract](docs/why-chain-contract.md), or, for a `file-carve-out`, no `provenance` at all: Hone refuses it as `import-unverified` otherwise. A `file-carve-out` is debt, so a record you write for new debt needs only its clause and file, with no `whyChain` and no `provenance`; a `reason` is an optional note. An `authorised-location` you write needs a `whyChain`; a repository whose `disciplines.json` sets `"fileExceptionWhyChains": "optional"` may give one only its `reason`, which will be refused in the next major release.

An imported `file-carve-out` needs a `decision`: copy the old entry's. If the old entry has none, stop and ask the human who accepted the debt. An imported `authorised-location` needs no `decision`: copy the old entry's if it has one, otherwise give `kind` and `source` only. Never write a placeholder or a root cause that only says the check was failing: Hone refuses those as `invalidRecords`.

Once the old records are converted, what is left is debt no old record covers: findings in a folder whose relaxed rule set was not carried over (step 2a), clauses the old route never checked, and inline disables or `@ts-expect-error` directives the old tool accepted ([section 14](#14-moving-to-recorded-inline-exceptions)). When the human approves recording it, run, with one `--leave` for each file the human decided is a permanent exception:

```bash
node_modules/.bin/hone record-debt --repo . --base-revision origin/main --leave <path>
```

Give it the branch's base, `origin/main`, not `HEAD` as this migration's other checks do: after step 6 the pre-push hook and CI assess decay against that base, so a record for a file this branch edits passes a check against `HEAD` and is forfeited there. Finish each file the migration edits, as [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a point 3 says, and confirm with `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main`, which assesses decay in that run whatever `assessment.forfeiture` says. Before you run it, put every pre-push hook, CI job and other machine that runs the check on this release or later: the records it writes give no `reason`, and a Hone from before file carve-outs could leave out `reason` stops with `load failure: file-malformed` on them. It adds a `file-carve-out` naming only its clause and file for each clause and file that no converted record holds, and leaves the converted records as they are. A converted record still holds its pair, so the command reports it `already-recorded` only if the check does not accept it; fix that record rather than adding another. [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a says how to read its output and review the result.

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

With pnpm, options go straight after the script name:

```bash
pnpm run --silent hone:project
pnpm run --silent hone:check --base-revision HEAD
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

With pnpm, run the check as `pnpm run --silent hone:check --base-revision HEAD`.

It must print a `CD-15#loops audit` finding and a `CD-1#explicit-any eslint` finding, then `verdict: fail`, and exit `1`. Use a selected clause in place of either if the repository did not adopt CD-15 or CD-1. Then remove both files (`git rm -f src/discipline-probe-loop.ts src/discipline-probe-any.ts`) and run the check again: it must print `verdict: pass` and exit `0`.

To see debt decay, change one line in a carved file, stage it and run the check: the record moves to `forfeited` and the run fails. Restore the file afterwards (`git restore --staged --worktree <file>`). Records `hone record-debt` wrote decay the same way as converted ones.

Stop here, do not remove anything, and ask the human if the check does not pass.

## 6. Remove the old route and repoint everything

Only after step 5 passes:

1. Delete the copied rule files and guides from step 1's harness folder (`.cursor/knowledge/aidlc-shared/code-discipline/` or its `.claude`/`.codex` equivalent).
2. Delete the copied tools tree and `harness.config.json`, unless anything else in the repository uses them. A repository that also runs the rin AIDLC plugin keeps `harness.config.json`, and in this same change sets `"constitution": { "engine": "hone", "baseRevision": "origin/main" }` in it. Otherwise rin's stage gate, sensors and review lenses keep running the old walker over the old records, and they refuse what this check passes. A rin plugin from before the rename refuses `"hone"` and takes `"discipline-core"`. Set `baseRevision` whenever a file carve-out or an imported entry exists.
3. Delete the old record files, `.constitution-carve-outs/cd-<id>.json` and `.constitution-authorised-locations/cd-<id>.json`: their content now lives in `discipline-exceptions.json`. To keep a file for each rule and kind, as those folders did, move to the split layout in a later change, as section 16 says. Leave any other file in those folders, and the folder that holds it: another tool, such as a hook, may read it.
4. In `package.json` scripts, CI and the pre-push hook, replace the old tool commands with the Hone check, as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows. Every run needs `--base-revision` while a file carve-out exists, unless it leaves forfeiture to another run as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows, and a run with imported records needs it in any case: in local scripts and the pre-push hook use the branch's base (`origin/main`, or `HEAD` to measure only uncommitted changes); in CI use the pull request's base commit. A run that leaves forfeiture to another run ends `verdict: pass (partial assessment)` or `verdict: fail (partial assessment)`, so a hook or gate that matches `verdict: pass` or `verdict: fail` at the end of the line reads neither; see the warning in [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5.
5. Rewrite the agent instructions to point at `node_modules/@hailstails/hone/rules/` and the judgement rules, as ADOPTING step 5 and step 9 say, and remove any instruction to read the old copied files.
6. Run the check and the repository's own validation command again, then commit everything in one change.

Stop and ask the human if anything outside the old trial uses the copied tools or `harness.config.json`.

## 7. Known differences

| | Old route | Hone |
| --- | --- | --- |
| What is installed | rule text only; checks were the repository's own linters, plus an optional copied tools tree | one package that runs every selected check |
| Selection | whole CD files, read by an agent; a check ran only if wired by hand | clauses in `disciplines.json`; every mechanical clause of an adopted discipline must be selected |
| First-adoption debt | inherited debt could be recorded without a why-chain | imported with `provenance` and no `whyChain`, accepted only while unchanged since `--base-revision`; a `file-carve-out` is debt and needs only its clause and file; a new or edited `authorised-location` or `clause-wide-carve-out` needs a causal five-step `whyChain` ([contract](docs/why-chain-contract.md)) |
| CD-1 | no exemptions | exempted like every other discipline, so existing `any` debt can be recorded |
| CD-3 flags | merged into the shared `compilerOptions`, wherever they were | set only in a base file not named `tsconfig.json`; any of the seven in a `tsconfig.json` is a finding |
| Running with debt | the decay check needed a base ref | every run with a file carve-out needs `--base-revision`, unless it sets forfeiture `elsewhere`; every run with imported or legacy-chain records needs it either way |
| Debt decay (CD-46) | optional `rin-harness-carve-out-decay.ts` run | built into every check run with `--base-revision` |
| Stale and unrecorded exceptions | not checked | fail the run, including linter ignores, `eslint-disable` comments and `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` directives with no record; an inline disable or directive is held by a file record on its clause and file, never by a clause-wide carve-out, and a lint-script option that weakens the run cannot be recorded at all |
| Path matching | old tools matched records by path suffix | exact repository paths |
| Linter | Biome, ESLint or oxlint for explicit `any` only | ESLint through the generated projection; Biome and oxlint are not Hone mechanisms |
| CD-8 exhaustive switch | typed ESLint `switch-exhaustiveness-check` suggested | the audit's `switch-defaults` clause only; type-aware linting is not supported |
| Judgement rules | read by an agent on request | each rule page names a review lens in `methods/lenses/`; ADOPTING step 9 is the procedure |

## 8. Moving to causal why-chains

An install from before the [why-chain contract](docs/why-chain-contract.md) holds chains with `whys`, `rootCause` and `owner` only. Hone still accepts such a chain while `--base-revision` holds its entry unchanged, but the first run without a base revision reports `legacy-chain-unmeasured` and fails. Do these steps in order:

1. **Give every check a base revision, before you refresh Hone.** Add `--base-revision` to the check command in `package.json` scripts, CI and the pre-push hook: `origin/main` locally, the pull request's base commit in CI. On a push to the main branch, the base is the commit before the push. Make sure CI fetches enough history to reach the base: `actions/checkout` defaults to one commit, so set `fetch-depth: 0` or fetch the base explicitly. A rin consumer whose `constitution.engine` is `"hone"`, or `"discipline-core"` before the rename, sets `constitution.baseRevision` in `harness.config.json`. Rin's stage gate and `disciplines` sensor pass it on.
2. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) step 10 says, and run the check. Every chain that is unchanged since the base passes. If the run lists `legacy-chain-unmeasured`, step 1 is missing somewhere. Any `why-chain-refused` entry is a legacy chain that is new or edited since the base.
3. **Rewrite each chain when you next touch its entry.** An edited entry with a legacy chain is refused until the chain follows the contract. Write the chain from the symptom down: ask why the exception exists, then ask why that answer is true, four more times. Add the `rootCheck` you ran today and the `readback`.
4. **Queue a rewrite of the rest.** Nothing ends the grace period: a legacy chain whose entry is never touched stays accepted. To make every chain causal, rewrite the remaining ones as tracked work. Rewriting a chain is an edit, so each rewritten chain must pass the contract in that change.

## 9. Moving from a copied source tree to the package

Hone is no longer installed by copying its source into the repository: this version ships no install files for that route. A copy of the source in `tools/discipline-core/` moves to the package, which reads the same `disciplines.json` and `discipline-exceptions.json` and runs on the repository's own toolchain.

The copy is an older release, so the package checks more than it did. Read these first, and do what applies before the first run on the package:

- [Section 8](#8-moving-to-causal-why-chains), if any exception's `whyChain` has no `rootCheck` and no `readback`: give every check a base revision first.
- [Section 10](#10-moving-from-the-discipline-core-names-to-hone) step 4: rule ids written by hand, such as in an `eslint-disable` comment, change from `discipline/...` to `hone/...`.
- [Section 14](#14-moving-to-recorded-inline-exceptions): each `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck` and `eslint-disable` is listed under `unrecorded` until it is removed or a file record holds it.
- [Section 15](#15-adopting-cd-2non-null-assertions), if any CD-2 clause is selected: CD-2 has a new clause to list.
- [Step 2a](#2a-carry-over-the-old-routes-settings), if the repository also ran rin's walker or another tool with settings of its own.

To move:

1. **Make sure the toolchain resolves from the repository root**, in the ranges [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 lists: TypeScript 4.8.4 up to 6.x, ESLint 9.28.0 or later on 9 or any 10, and typescript-eslint 8.56.0 or later on 8. Keep the versions the repository already uses.
2. **Install the package** as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says, including the two `hone:` scripts.
3. **Repoint every command.** In scripts, CI and the pre-push hook, replace `node tools/discipline-core/core/check/check-command.ts --repo .` with `npm run --silent hone:check`, and `project-command.ts` with `npm run --silent hone:project`. Pass options after `--` with npm, as in `npm run --silent hone:check -- --base-revision origin/main`, and straight after the script name with pnpm, as in `pnpm run --silent hone:check --base-revision origin/main`. A hook or gate that reads the verdict line needs the warning in [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5. Point agent instructions at `node_modules/@hailstails/hone/rules/`.
4. **Repoint your own pieces and tests.** Nothing outside the package's public entries can be imported now:
   - A piece that imported types or `folderScope` from the copy, such as from `walker-piece.ts` or `source-scope.ts`, imports them from `@hailstails/hone/audit`.
   - A piece that read JSON with comments through the copy's `jsonc-parse.ts` calls TypeScript's own parser on the syntax API that `prepare` hands it: `syntaxApi.parseConfigFileTextToJson(file, text)` returns the parsed value as `config`, and sets `error` when it cannot parse the text. Do not import `jsonc-parser`: it is Hone's own dependency, not one the repository declares, so a strict package manager such as pnpm does not resolve it from a piece, and a piece imports only what [docs/extending.md](docs/extending.md#what-is-stable) lists.
   - For a file it cannot parse, a piece returns `{ outcome: "failed", error: { kind: "file-unparseable", file, detail } }`. The check then stops with `load failure: runner-failed audit file-unparseable <file> <detail>` and exit `2`.
   - Case tests use `clauseConformanceOf` from `@hailstails/hone/testing`, as [docs/extending.md](docs/extending.md#test-a-piece) shows.
   - A test that called the copy's check or governance functions directly, such as `runCheck` or `applyGovernance`, has no entry to call: run the `hone check` command against a repository the test sets up, and assert on its report and exit code.
5. **Remove the copy.** Delete `tools/discipline-core/`, its line in `.gitignore`, and its entry in `disciplines.json`'s `exclude`.
6. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection now imports each piece by package name instead of by a path into `tools/discipline-core/`, so it changes once; commit it.
7. **Run the check.** Compare it with the last run on the copy. A `readFirst` line now names its rule page under `node_modules/@hailstails/hone/rules/`, not in the copy. Any other new line comes from what the package checks that the copy did not, which the sections listed above describe. A `toolchain-unavailable` load failure names a package to install at the repository root.

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
2. **Rename the scripts and repoint their callers.** In `package.json`, replace the two scripts with `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."`, then change every caller of the old scripts or commands: CI, the pre-push hook and the validation script. Flags are unchanged: with npm they go after `--`, with pnpm straight after the script name.
3. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection's imports, block names and rule ids change once; commit it.
4. **Rename old rule ids written by hand.** Any `eslint-disable` comment, team config rule entry or suppression that names `discipline/...` or `discipline-cd<N>/...` now names a rule that no longer exists. The check does not list it: it names no selected rule, so it drops out of `unrecorded` instead of appearing there. What appears is the finding it no longer suppresses, in the repository's own ESLint run. Search the repository for `discipline/` and `discipline-cd` and rename each to `hone/...` or `hone-cd<N>/...`, so the check governs it again.
5. **Repoint agent instructions** from `node_modules/discipline-core/rules/` to `node_modules/@hailstails/hone/rules/`.
6. **Run the check.** It must give the same report as the last run under the old names.

A repository whose own tooling calls the commands, such as the rin harness, changes those calls on its own side. The engine name in `harness.config.json` belongs to that tooling: a current rin plugin names it `"hone"` and still accepts `"discipline-core"`, as [step 6](#6-remove-the-old-route-and-repoint-everything) says.

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

1. **Swap the package.** Run `npm uninstall honed`, then install `@hailstails/hone` as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says: from npm at an exact version, or the tarball attached to the latest [GitHub release](https://github.com/HailsTails/hone/releases). Remove the vendored `honed-0.1.0-pre.1.tgz` if the repository keeps one, or replace it with the new tarball. `typescript` is now a required peer, where `honed` declared it optional: if the repository root does not already declare it, npm 7 and later install the newest supported release on their own, so add it to `devDependencies` at the version the repository uses.
2. **Re-project straight away** if any clause is `eslint`, before the check, the linter or anything else runs: `npm run --silent hone:project`, then commit `disciplines.eslint.mjs`. Until then the committed projection still imports `honed/...`, which is no longer installed, so the repository's own ESLint cannot load its configuration and the check stops with `load failure: runner-failed eslint team-config-unloadable eslint.config.mjs, the ESLint config for <file>, failed to load: Cannot find package 'honed' imported from ...disciplines.eslint.mjs ...` and exit 2. `hone project` does not load the old projection, so it runs and repairs it. Its import specifiers change from `honed/...` to `@hailstails/hone/...`, and its block names from `honed/...` to `hone-core/...`, in that same re-projection. The disciplines' rule ids `hone/...` and `hone-cd<N>/...` stay, so an `eslint-disable` comment, team config entry or suppression needs renaming only if it names `honed/inline-config`, which is now `hone-core/inline-config`.
3. **Keep the scripts.** `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."` work unchanged, because the command is still `hone`.
4. **Repoint agent instructions** from `node_modules/honed/rules/` to `node_modules/@hailstails/hone/rules/`.
5. **Run the check.** It must give the same report as the last run under `honed`.

## 12. Moving off `waivedClauses`

Earlier releases let a repository record a `clause-wide-carve-out` and set `"assessment": { "waivedClauses": "not-run" }` in `disciplines.json`, or pass `--waived-clauses not-run`, so the carved-out clause was not run. That setting and that flag are gone. A clause now states this itself, in `clauses`. With either one still in place, `disciplines.json` is `file-malformed`, naming `waivedClauses` and the clause states to use, or the flag is `arguments-invalid`.

For each clause the setting skipped:

1. **Say what is true of it.** Set the clause to `"not-run"` when the rule binds but its check is not a true measure of the rule here, or cannot work here, such as CD-6's ESLint-only `naming-convention` with no ESLint installed: the report lists it under `notRun`, and the rule is owed through review. Set it to `"not-adopted"` when the rule does not apply to this codebase. If neither is true, and the clause is debt the codebase cannot pay right now, keep its mechanism and its carve-out, and let the check run; see [ADOPTING.md](ADOPTING.md#4-write-disciplinesjson) step 4.
2. **Delete its carve-out** from `discipline-exceptions.json` when the clause is now `"not-run"` or `"not-adopted"`: an entry on such a clause is invalid, as `clause-not-run` or `clause-not-adopted`, and fails the run.
3. **Remove the setting and the flag.** Delete `waivedClauses` from `assessment` in `disciplines.json`, and `--waived-clauses` from scripts, CI and the pre-push hook.
4. **Re-project** if any clause was `eslint`: run `npm run --silent hone:project`. The projection no longer carries the clause's rule or its `"off"` block; commit it.
5. **Run the check.** The `assessment` section's `waived-clauses` line is gone, and the verdict line is no longer marked `(partial assessment)` unless forfeiture is assessed elsewhere.

## 13. Moving to package projection slices

Earlier releases wrote one `disciplines.eslint.mjs` at the repository root, and every package config spread it. A package linted from its own folder resolves `files` against that folder, so the root projection's carve-outs never matched there. Hone now writes a slice per config root; see [README.md](README.md#package-slices).

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) step 10 says, and run the check. Under the nearest-to-file lookup, each folder with a tracked `eslint.config.*` is a config root, and the check fails with `eslint missing <package>/disciplines.eslint.mjs` for each until its slice is written.
2. **Project and commit.** Run `npm run --silent hone:project` and commit every `disciplines.eslint.mjs` it writes, the root one and each package's.
3. **Spread each package's own slice.** In each package config, import `./disciplines.eslint.mjs` from that package's folder and spread it last, in place of the root projection. A package still spreading the root projection is reported `eslint not-applied <package>/disciplines.eslint.mjs` once a recorded file there is under check.
4. **List generated configs.** A package whose `eslint.config.*` a tool generates and git ignores gets no slice until its folder is listed under `eslintConfigRoots` in `disciplines.json`. Each listed folder must be one git tracks files under, outside every `exclude` path, or the check stops with `config-root-untracked`.
5. **Repositories that move to the repository-root lookup after adopting slices.** A repository that was on the repository-root lookup from the start never had package slices, and can skip this step. One ESLint 9 run applies the root config to every file, so no package folder is a config root. `hone project` removes each package slice it wrote whose bytes it would still write, and reports any other as `left-in-place`. If anyone lints from a package folder, a package config that imports its slice then fails with `Cannot find module`: list that package under `eslintConfigRoots` to keep its slice, or stop importing it there.
6. **Folders holding their own `disciplines.json`** get no slice: their ESLint configuration is not managed from this repository, as nested Hone configurations are not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)). When such a folder's own config leaves a carve-out recorded there out of effect, the `mechanism-not-run eslint not-included` line adds it. Governing the folder from this repository works today: remove its `disciplines.json`, keep its records here, and `hone project` writes its slice.

## 14. Moving to recorded inline exceptions

Earlier releases reported an `eslint-disable` comment naming a selected rule as an `inline-disable` no record could cover, and did not report TypeScript directives at all. Inline exceptions are now debt on the clause they escape, in their file, held by the file records you already write.

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) step 10 says, and run the check. Each `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` in a `.ts` or `.tsx` file is listed under `unrecorded` as `CD-2#cast-expressions audit inline-disable <file>:<line> <comment>`, test files included, and each `eslint-disable` as before.
2. **Remove what you can.** A directive or disable that hides nothing is cheaper to delete than to record.
3. **Record the rest per clause and file.** Add a `file-carve-out` for debt, or an `authorised-location` where the clause truly does not apply to that file, on the clause the line names and that file. `hone record-debt` writes the debt records ([ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a). One record holds every inline exception of that clause in the file. A `clause-wide-carve-out` does not hold them, and a tracked reference on the comment (CD-5) does not stand in for the record. Editing a carved file forfeits the carve-out, and each inline exception it held is listed again.
4. **Name the rule in a bare disable.** An `eslint-disable` naming no rule escapes every selected ESLint clause and needs a record for each. Its lines end `names no rule and escapes every selected clause: naming the rule is the cheap fix`.
5. **Fix lint-script options.** A `command-line-option` line that ends `weakens the script's whole run, so no record can cover it: remove it from the script` names an option to remove. One that ends `is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as "<invocation>"` names a script such as `tsc && eslint -c eslint.config.mjs .`: move the quoted command to a script of its own, then run the check again. One that ends `comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` quotes the first token Hone does not read, such as `env` or a runner flag like `-y`: rewrite the command so only package runners and `NAME=value` settings, including `cross-env NAME=value`, come before `eslint`. `-c` naming the config ESLint already finds, and `--ignore-pattern` that ignores no checked file, are not reported once `eslint` runs plainly.
6. **Stale records may clear.** A record that holds a native exception it can cover now counts as used. An `authorised-location` or `file-carve-out` that held only a `config-override`, and was listed `stale` while dropping it left the override unrecorded, is no longer stale.
7. **Standalone runners** written outside Hone return `{ hits, nativeExceptions }` from `run`, where `nativeExceptions` holds only `inline-disable` entries with `reach`, in place of a bare list of hits. A runner still returning the list fails with `runner-invalid-output` naming that shape.

## 15. Adopting `CD-2#non-null-assertions`

CD-2 gained a clause, `CD-2#non-null-assertions`, checked through `eslint` only. It flags non-null assertions, `x!`, and definite assignment assertions, `let x!: T` and `field!: T`; see [rules/CD-2/CHECKS.md](rules/CD-2/CHECKS.md). A repository that selects any CD-2 clause has adopted CD-2, so after refreshing Hone its check fails with this line under `uncovered` until `disciplines.json` lists the new clause:

```text
CD-2#non-null-assertions
```

Choose one state for it, as [ADOPTING.md](ADOPTING.md#4-write-disciplinesjson) step 4 sets out:

1. **The repository runs the ESLint mechanism.** Add `"CD-2#non-null-assertions": "eslint"` to `clauses`, then run `npm run --silent hone:project` and commit `disciplines.eslint.mjs`, and each package slice it writes. Run the check. Each existing `!` is a finding; fix it, or hold it as debt with a `file-carve-out` per file, or a `clause-wide-carve-out` with an owner, after the human approves, and re-run `hone:project` so the projection carries the records. An `eslint-disable` naming no rule now escapes this clause too, and is listed under `unrecorded` for it until a file record on this clause holds it, as section 14 says; naming the rule it means is the cheap fix.
2. **The repository has no ESLint, or the rule binds but its check is not a true measure here.** Add `"CD-2#non-null-assertions": "not-run"`. The report lists it under `notRun`, and review owes the rule. Nothing is projected and ESLint is not loaded for it.
3. **The rule does not apply to this codebase.** A tech lead says so in the open, and the clause is listed as `"not-adopted"`. The report lists it under `notAdopted`.

Neither `"not-run"` nor `"not-adopted"` takes an exception record. Stop and ask the human before choosing `"not-adopted"`, or before recording carve-outs for existing `!` sites.

## 16. Moving to the split layout

`discipline-exceptions.json` holds every record in one file. The split layout keeps the same records in the `discipline-exceptions` folder, one file for each record kind and discipline, as `.constitution-carve-outs/cd-<id>.json` and `.constitution-authorised-locations/cd-<id>.json` did: [README.md](README.md#the-split-layout) describes it. Moving is optional, and a repository that does nothing keeps the single file.

1. **Start a branch from the base your hook and CI pass to the check**, such as `origin/main`, with no other change to the records in it. Fetch the base first, so it is current.
2. **Split the records:**

   ```bash
   node_modules/.bin/hone split-records --repo .
   ```

   It prints `<path> written` for each file and `discipline-exceptions.json removed`. Within each file the records keep the order they had. It refuses a record whose clause names no discipline, naming its index: fix the clause or remove the record, then run it again. It also refuses a `discipline-exceptions.json` holding keys other than `version` and `exceptions`, such as `$schema` or `notes`, naming them, since no split file keeps them: remove them, or keep what they say elsewhere, then run it again.
3. **Re-project and check against the same base.** With any `eslint` clause, run `npm run --silent hone:project`; it prints `unchanged`, since the projection does not depend on where a record is kept. Then run `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main` (with pnpm, `pnpm run --silent hone:check --forfeiture this-run --base-revision origin/main`). The base still holds `discipline-exceptions.json`, and Hone reads the base in whichever layout it holds, so imported and legacy-chain records are still verified against it. `--forfeiture this-run` makes this run assess decay whatever `assessment.forfeiture` says. The report is the one the check printed before the split, except that a section listing records, such as `stale`, lists them in the order of the new files.
4. **Commit the removal and the new files in one change.** A tree that holds both `discipline-exceptions.json` and the folder fails every run with `records-in-both-layouts`. Point any code owners or review rules at the new files, such as `discipline-exceptions/file-carve-outs/cd-19.json`.

From then on, `hone record-debt` adds each record to its discipline's file, and a record a person writes goes in the file of its kind and discipline: one in any other file fails the load as `file-malformed`, naming the file it belongs in.
