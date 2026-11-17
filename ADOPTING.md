# Adopting Hone

This page takes a TypeScript repository from nothing to a checked, passing run. Do the steps in order. Every command is run from the root of the repository being checked, which this page calls `<repo>`. Nothing here needs AIDLC or any agent harness. A repository that adopted the disciplines through the older standalone copy route follows [MIGRATING.md](MIGRATING.md), which uses these steps.

Hone reads `disciplines.json` in `<repo>`, runs the selected disciplines' checks over every git-tracked file, applies the exceptions in `discipline-exceptions.json`, and prints one report ending in `verdict: pass` or `verdict: fail`.

## 1. Check the prerequisites

```bash
node --version
```

It must print `v22.18.0` or a later 22.x, or `v24.0.0` or later. A rule set of your own may write its piece modules as `.ts` files, which Hone runs with Node's built-in type stripping, so they are limited to what [Node's TypeScript support](https://nodejs.org/docs/latest-v22.x/api/typescript.html) allows: only syntax that can be erased, so no enums, no namespaces that hold values and no parameter properties; relative imports that spell the `.ts` extension; and `import type` (or `type` on each name) for anything that is only a type. Node does not strip types from files under `node_modules`, so a rule set installed as a package must ship `.js`. Also needed: git 2.24 or later and npm. `<repo>` must be a git repository, and the files to check must be committed or staged: untracked files are not checked.

## 2. Install the Hone package

Hone ships as one npm package tarball: built JavaScript with its own packages bundled in, so it has no dependencies of its own and needs no TypeScript support from Node.

**The npm package is named `@hailstails/hone`.** The unscoped name `hone` on npm belongs to an unrelated package: never run `npm install hone`. The package `@hailstails/hone` installs one command, `hone`. Its tarball is named `hailstails-hone-<version>.tgz`, the file name `npm pack` gives a scoped package. Its first pre-release was released under the old name `honed`; [MIGRATING.md](MIGRATING.md#11-moving-from-honed-to-hailstailshone) says how to move from it.

Releases are pre-releases until a stable release is published: until then, commands, flags and files may still change between releases.

The main route is the npm registry. Pre-releases are published under the dist-tag `next`, so name it:

```bash
npm install --save-dev @hailstails/hone@next
```

npm records it in `package.json`, and the exact version it installed in the lockfile. Check the name before you run it: `@hailstails/hone`, never the unscoped `hone`. With pnpm or Yarn, add `@hailstails/hone@next` with their own `add -D` command at the workspace root. `next` names the newest pre-release approved on npm, so it can trail the newest GitHub release for a while; [README.md](README.md#developing-hone) says how a version reaches npm.

The alternative is a tarball, copied into the repository so every teammate and CI runner installs the same bytes without the registry. This page writes its location as `<hone-tarball>`: a path such as `vendor/hailstails-hone/hailstails-hone-<version>.tgz`, or an `https://` URL your team serves it from. Download the tarball attached to the latest [GitHub release](https://github.com/HailsTails/hone/releases), or build it from a pinned commit as below.

To build the tarball yourself, use Node.js 22.18 or later with [corepack](https://nodejs.org/api/corepack.html) available, which provides the pnpm version `package.json` pins, and pick the commit to pin, such as the latest on [`main`](https://github.com/HailsTails/hone/commits/main). Then run, with that commit's SHA in place of `<pinned-sha>`:

```bash
git clone -c core.longpaths=true https://github.com/HailsTails/hone.git /tmp/hone-source
git -C /tmp/hone-source checkout <pinned-sha>
cd /tmp/hone-source && corepack pnpm install --frozen-lockfile && corepack pnpm run pack-package && cd -
```

The last command prints `pack package: wrote <path>/artefacts/hailstails-hone-<version>.tgz`. Copy the downloaded or built tarball into `<repo>/vendor/hailstails-hone/` and commit it with a message naming the release tag or the pinned SHA. The commands in this guide are POSIX shell; on Windows run them in Git Bash.

Install it as a development dependency of the repository root, beside the toolchain:

```bash
npm install --save-dev <hone-tarball>
```

npm records it in `package.json` and the lockfile. With pnpm or Yarn, add the same tarball with their own `add -D` command at the workspace root.

Add the two commands to the root `package.json` scripts:

```json
"scripts": {
  "hone:check": "hone check --repo .",
  "hone:project": "hone project --repo ."
}
```

`hone` is the package's one command, with two subcommands: `hone check` runs the check and `hone project` writes the ESLint projection. `hone` with no subcommand, or with any other, exits `2` with a `load failure: arguments-invalid` line that prints the usage.

Hone runs on the toolchain the repository already uses, which the package declares as peer dependencies: `typescript` is a required peer, because every `audit` clause needs it, and the ESLint packages are optional peers, needed only for `eslint` clauses. npm 7 and later install a missing required peer on their own, and some other package managers only warn about one, so declare `typescript` yourself at the repository root, at the version the repository already uses, rather than let the package manager choose or skip it. Keep the versions you have; Hone supports these ranges:

| Package | Needed for | Range |
| --- | --- | --- |
| `typescript` | any `audit` clause | `>=4.8.4 <7.0.0` |
| `eslint` | any `eslint` clause | `^9.28.0 \|\| ^10.0.0` |
| `@typescript-eslint/parser` | any `eslint` clause | `^8.56.0` |
| `@typescript-eslint/eslint-plugin` | any `eslint` clause | `^8.56.0` |

A repository that already has them in range needs nothing more. A package that is missing or out of range is named when the check runs; add it at a version inside its range and inside the range your other tooling accepts, without moving ESLint or TypeScript to another major for Hone's sake.

Hone finds these by Node's resolution upward from where the package is installed, so in a monorepo they must resolve from the repository root: declare them in the root `package.json` (with pnpm, `pnpm add -Dw` at the versions the packages already use), even where packages also declare their own. Yarn Plug'n'Play is not supported, because Hone resolves the toolchain through `node_modules`.

Commit `package.json`, the lockfile and the tarball if it is a file in the repository. To update later, run `npm install --save-dev @hailstails/hone@next` again, or repeat this step with a newer tarball.

## 3. Read what each discipline means

[rules/README.md](rules/README.md) lists every discipline. Each discipline has two pages. `rules/<ID>/README.md` quotes the rule, names its review lens, and gives its spirit: what the friction is for, what a finding usually points at, the direction to go, and the principles behind it. `rules/<ID>/CHECKS.md` holds the mechanics: the Clauses table, exactly what each check flags, a violation and its fix, and how to record an exception. Read the rule page first; [the spirit of the rules](rules/SPIRIT.md) explains the approach for the whole set. A discipline's clause addresses are in its CHECKS.md Clauses table, for example `CD-14#class-syntax`, with the mechanism that checks each clause. A clause whose mechanism is `review` is a judgement clause: it is applied in review, not by a check, with the review lens the rule page names (step 9).

A check covers only what its CHECKS.md says it flags. Read the whole rule, not only the Clauses table: where a rule asks for more than its check can see, CHECKS.md says which part is left to review, and the rule's review lens covers that part.

Where to start: for an API, boundary validation (CD-4, CD-45), result-shaped failures (CD-9, CD-10, CD-11) and inward dependency direction (CD-12, CD-13) are useful next selections, most of them judgement rules. For React, first select the type and test disciplines that apply to component code; do not apply server ports or process-lifecycle rules to browser code.

## 4. Write disciplines.json

Create `<repo>/disciplines.json`. Map every clause you adopt to the mechanism that checks it:

```json
{
  "version": 1,
  "ruleSets": {},
  "clauses": {
    "CD-15#loops": "audit",
    "CD-17#clock-sources": "audit",
    "CD-23#export-test-sibling": "audit"
  }
}
```

- `clauses` keys are clause addresses from the rules' CHECKS.md pages; the value is a mechanism the clause's CHECKS.md lists, `audit` or `eslint`, `"not-run"` or `"not-adopted"`.
- Selecting one clause of a discipline adopts the whole discipline: any of its other mechanical clauses you leave out are reported as `uncovered` and fail the run. CD-3 has seven clauses; select all seven or none.
- A discipline may span mechanisms; adopt every mechanical clause through the mechanism that has it, or the discipline reports the rest uncovered. CD-14, for example, checks `class-syntax` through `audit` or `eslint` but `static-only-class` only through `eslint`, so adopting CD-14 means adopting the ESLint mechanism for at least that clause; see [README.md](README.md#adopting-the-eslint-mechanism). If ESLint cannot work in this repository, list such a clause as `"not-run"`, as below.
- A clause's value in `clauses` is one of three:
  - a mechanism id, such as `audit`: the check runs and its findings fail the run;
  - `"not-run"`: the clause is adopted, but its mechanism is not run; the report lists it under `notRun` as `adopted, mechanism not run: enforced by review`;
  - `"not-adopted"`: the clause is not adopted; the report lists it under `notAdopted`.
- A `"not-run"` or `"not-adopted"` clause is never run and never projected, not even as `"off"`, and its mechanism is not loaded unless another clause uses it, so a repository that lists every ESLint clause this way needs no ESLint installed. Both leave the run a whole assessment. Neither takes an exception record: one on such a clause is invalid as `clause-not-run` or `clause-not-adopted`.
- When a clause's check cannot simply run clean, [the spirit of the rules](rules/SPIRIT.md#not-adopted-not-run-carved-out-escaped) names three declared states. Choose one deliberately, with reasons:
  - Not adopted: the rule does not apply to this codebase; a tech lead declares that, in the open. Set the clause to `"not-adopted"`.
  - Adopted, mechanism not run: the rule binds, but its check is not a true measure of the rule's intent here, or cannot work here for a technical reason. The check is set aside; the intent is still owed, through review. Set the clause to `"not-run"`. CD-6's ESLint-only `naming-convention` in a repository without ESLint is the usual case: `"CD-6#identifier-names": "audit", "CD-6#naming-convention": "not-run"`.
  - Clause-wide carve-out: the rule binds and its check is sound, but the codebase has debt it cannot address right now. Keep the clause's mechanism, so the clause still runs, and record the debt against it as a `clause-wide-carve-out` with its why-chain and an owner who will pay it down (step 7).
- `exclude` lists folders or exact files, as repository paths with forward slashes; an entry containing `*` is refused, because globs are not supported. A folder entry excludes everything under it. Use it for generated or third-party code. `node_modules`, `dist`, `build`, `coverage`, `.git` and a top-level `vendor` folder are skipped already.
- `clauseSettings` gives a clause the settings its CHECKS.md lists under Settings, keyed by clause address. CD-19, for example, flags only imports of the packages you list in its `confinedPackages`; CD-5's `trackerPatterns` narrows tracked references to your tracker's format. See [README.md](README.md#disciplinesjson).
- `ruleSets` stays `{}` unless you write disciplines of your own; see [docs/extending.md](docs/extending.md).

Every clause address Hone ships:

```text
audit:
CD-1#any-cast            CD-2#cast-expressions      CD-5#comments-directives
CD-6#identifier-names    CD-7#categorical-paths     CD-7a#factory-return-types
CD-8#switch-defaults     CD-10#throws-in-tests      CD-14#class-syntax
CD-15#loops              CD-17#clock-sources        CD-19#import-boundaries
CD-23#export-test-sibling                           CD-25#dependency-isolation
CD-26#module-mocking     CD-27#test-body-logic      CD-43#boolean-signatures
CD-44#parameter-mutation CD-47#hermetic-git-spawns
CD-3#strict  CD-3#no-unchecked-indexed-access  CD-3#exact-optional-property-types
CD-3#no-implicit-override  CD-3#no-fallthrough-cases-in-switch
CD-3#no-property-access-from-index-signature  CD-3#use-unknown-in-catch-variables

eslint:
CD-1#explicit-any        CD-1#implicit-any-let      CD-6#naming-convention
CD-7#filename-case       CD-10#throw-only-error     CD-14#class-syntax
CD-14#static-only-class  CD-27#focused-tests        CD-27#skipped-tests
CD-40#parameter-count    CD-41#cognitive-complexity CD-41#function-length
CD-42#useless-else       CD-44#parameter-reassignment
```

CD-1, CD-6, CD-7, CD-10, CD-14, CD-27 and CD-44 have clauses under both mechanisms, and CD-40, CD-41 and CD-42 only under `eslint`, so adopting any of them needs the ESLint mechanism.

Starting with a few disciplines and adding more once the run passes is easier than fixing everything at once.

### 4a. Set up ESLint for `eslint` clauses

Skip this if every selected clause is `audit`. Otherwise, after writing `disciplines.json`, write the ESLint projection:

```bash
npm run --silent hone:project
```

It prints `disciplines.eslint.mjs written`. Spread its default export last in the repository's flat config. The projection sets rules only, so the config must also parse TypeScript, with the `@typescript-eslint/parser` that step 2 installs; without it the repository's own `eslint` run fails on the first type annotation while Hone's check still passes. A repository with no ESLint config yet can start from this `eslint.config.mjs`:

```js
import typescriptParser from "@typescript-eslint/parser";
import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"], languageOptions: { parser: typescriptParser } },
  ...projection,
];
```

To confirm it, run the repository's own `eslint` on one TypeScript file with a type annotation, for example `node_modules/.bin/eslint src/index.ts` with a file of your own; it must report findings or nothing, never `Parsing error`.

In a monorepo where ESLint resolves each file from its nearest config, `hone:project` also writes a `disciplines.eslint.mjs` slice beside each package's tracked `eslint.config.*`, holding only that package's exceptions with paths relative to the package. Where one ESLint 9 run applies the root config to every file, package configs are never loaded and get no slice. A package config keeps its slice even in a folder the root config ignores, since a lint run from that package loads its own config without the root's ignores. A folder holding its own `disciplines.json` gets no slice: its ESLint configuration is not managed from this repository, and nested Hone configurations are not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)); when that leaves a carve-out recorded there out of effect, the check names the folder on its `mechanism-not-run eslint not-included` line. The root config spreads the root projection last, and each package config spreads its own slice last, never the root one:

```js
import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
```

A package whose `eslint.config.*` is generated and not tracked needs its folder listed so Hone writes its slice, and the slice spread where the tool takes extra configuration. Each listed folder must be one git tracks files under, spelled exactly as git spells it, or the check stops with `config-root-untracked`. sku 16.6.1 is such a tool: its `packages/sku/src/utils/configureApp.ts` writes `eslint.config.mjs` into the project on every sku command and adds it to `.gitignore`, and that config applies the `dangerouslySetESLintConfig` function that `packages/sku/src/types/types.ts` declares as taking and returning `Linter.Config[]`. For sku, list the package in `disciplines.json` and spread the slice in `sku.config.ts`:

```json
{ "eslintConfigRoots": ["packages/web"] }
```

```ts
import projection from "./disciplines.eslint.mjs";

export default {
  dangerouslySetESLintConfig: (skuEslintConfig) => [...skuEslintConfig, ...projection],
};
```

The check names a slice that is missing, out of date, or not applied to that package's files, and names a listed folder whose `eslint.config.*` is not on disk as `unconfigured`: until the tool has written it, nothing loads the slice, so run the tool's configure step (for sku, any sku command or `sku configure`) before the check. A package that spreads nothing at all shows its files under `unrecorded` as `config-override` while it has no file exception of its own; once a file under check there has one, the package is also reported `not-applied`. Hone sees which slice a package config spreads only through its effect: a package config that spreads the root projection by mistake is reported `not-applied` once a file under check in that package has a file exception the root projection cannot carry. Until then the check says nothing, because for a package with no file exceptions of its own the root projection and the slice switch on the same rules, and clause-wide carve-outs reach the package either way. To confirm the spread before adding an exception, run ESLint from the package folder on a file the check flags and see the same finding. [README.md](README.md#package-slices) has the details. Hone detects which config the team's ESLint run applies from the installed `eslint` version and the lint scripts; see [README.md](README.md#runtime). Detection is wrong when a task runner (turbo, nx, `pnpm -r`) starts ESLint 9 inside each package, because each package then uses its own config, and when ESLint 9 gets the lookup flag outside the scripts. In those repositories set the lookup in `disciplines.json`:

```json
{ "eslintConfigLookup": "nearest-to-file" }
```

Use `"nearest-to-file"` when ESLint runs per package, with ESLint 10, or with ESLint 9 and `--flag v10_config_lookup_from_file` (on 9.28 and 9.29, `--flag unstable_config_lookup_from_file`). Use `"repository-root"` for one ESLint 9 run from the repository root, whose root `eslint.config.*` then applies to every file. To confirm the setting, lint a package file the way the team does (for example `pnpm exec eslint packages/a/src/x.ts` from where the lint script runs) and check that it reports the same finding the Hone check lists for that file.

Commit the projection, every slice and the configs. Hone's check reads this configuration and fails if the projection or a slice is missing, not in effect, or out of date, so re-run `hone:project` whenever `disciplines.json` or `discipline-exceptions.json` changes or Hone is updated. The projection imports each piece from the package by name, for example `@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js`, so the repository's ESLint must resolve `@hailstails/hone` from the repository root. Hone's own ESLint run uses the repository's root `eslint` from step 2, the same copy the projection's pieces load; its verdict is the same on 9.x and 10.x. [README.md](README.md#adopting-the-eslint-mechanism) has the details.

## 5. Run the check

```bash
npm run --silent hone:check
```

| Exit code | Meaning |
| --- | --- |
| `0` | `verdict: pass` |
| `1` | `verdict: fail`: the report says why |
| `2` | an input could not be loaded or a check crashed; the output is one line starting `load failure:` or names the failing piece |

`npm run` passes the exit code through. `sh: hone: not found` or `'hone' is not recognized` means step 2's install is missing; run `npm install`. A `load failure: runner-failed <mechanism> toolchain-unavailable <package> ...` line names every toolchain package that is missing from the repository root or outside its range; install a version of each in the range it prints. For a `typescript` that is not installed, the line says the install is incomplete, since a supported install always has its required peer: add `typescript` to the root's `devDependencies` and reinstall. A `toolchain-shadowed <package> resolved from ...` line means a copy of that package sits inside Hone's own install folder, which the line names: delete that `node_modules` folder and reinstall.

Add the check to the repository's existing validation script, and run that script in CI and in any pre-push hook the repository already has, so the check runs wherever the other checks run.

A first adoption assesses decay at push only, so that a hotfix in a carved file is not blocked in CI while the check is new: set `"assessment": { "forfeiture": "elsewhere" }` in `disciplines.json`. CI and the pre-push hook then run different commands. The pre-push hook assesses decay for its run:

```bash
npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main
```

CI leaves decay to the hook. A repository with no imported records and no legacy-chain records runs the check with no base revision:

```bash
npm run --silent hone:check
```

A repository with imported records (`provenance`) or legacy-chain records still needs a base revision in CI, because those records are checked against it; without one the report lists `import-unmeasured` or `legacy-chain-unmeasured` and the run fails. Pass the pull request's base commit with `elsewhere` in effect: the base is then used for those records only, and nothing is forfeited. CI needs that one commit fetched, for example `git fetch --depth=1 origin <base-commit>`, not the full history:

```bash
npm run --silent hone:check -- --base-revision <base-commit>
```

A team that assesses decay in CI leaves `assessment` unset and runs `npm run --silent hone:check -- --base-revision origin/main` there; the check then needs that revision and the history back to where the branch left it, for example `fetch-depth: 0` with `actions/checkout`.

The trade: a push that bypasses the hook, for example with `git push --no-verify`, leaves no later gate, so carve-out debt can stop decaying unnoticed. Every run that leaves decay to another run says so in its report (step 6). With `eslint` clauses, the repository's own `eslint` run also reports them in the editor, from the projection.

Tell any coding agent working in the repository, in its project instructions: "Read the rule pages under `node_modules/@hailstails/hone/rules/` for the disciplines in `disciplines.json` before editing. When a check fails, read the section for the failing clause in `disciplines.assessment.md` and the Spirit section of the clause's rule page before changing anything; do not add an exception, exclusion or setting to make it pass. Before handing off, run the repository's validation command, report its exit code and findings, and apply the judgement rules listed in `disciplines.assessment.md` with their review lenses." Copying the rule pages does not make an agent read them; the instruction does. Step 5a writes `disciplines.assessment.md`.

### 5a. Write the assessment

The first run on an existing codebase usually fails, often with many findings. Each finding is a signal about the design: a missing boundary, an earlier choice that forces the workaround, a port wider than its use. Before fixing or recording anything, write down what the signals mean in this codebase, in `<repo>/disciplines.assessment.md`. Whoever later hits a red check then has more to go on than the assumption that the friction is unnecessary: the file says what that clause points at here and where the code is going.

Each rule page's Spirit section lists the usual causes behind its findings. The assessment does not repeat them. It says which cause applies here, where, the forward goal in this codebase's terms, and the steps toward it.

Start from the template the package ships:

```bash
cp node_modules/@hailstails/hone/methods/assessment-template.md disciplines.assessment.md
```

Fill the top sections: the rules adopted, the clauses not adopted because the rule does not apply here, the clauses adopted with their mechanism not run because the check is not a true measure here or cannot work here, and the judgement rules adopted (step 9). Step 4 says how each is declared in `disciplines.json`; the assessment says why.

Then write one section per high-count clause. Hone has no threshold for this. A clause is high-count when its findings will not all be fixed in the change that adopts it: three findings in one file you fix today need no section; three findings in three folders you will not reach this week do.

The assessment is usually drafted by a coding agent. Give it this instruction as it is:

```text
Draft disciplines.assessment.md from node_modules/@hailstails/hone/methods/assessment-template.md, using the latest hone:check report.

For each clause in the report's findings section whose findings will not all be fixed in this change:
1. Measure. Count its findings and group them by folder, by the value, library or dependency involved, and by the shape of the code.
2. Read the code at several sites in each group, not only the report lines.
3. Read the clause's rule page, node_modules/@hailstails/hone/rules/<ID>/README.md, in full, and its Spirit section closely.
4. Match each group against the causes listed under "What a finding points at". Name the cause exactly as the rule names it. If no listed cause fits, say so and describe what the sites show; do not pick the closest.
5. Write the clause's section from the template: the cause, the count and example sites as file:line, the forward goal in this codebase's terms, and the steps that change the code toward it, starting with the step that unlocks the others.

Exclusions, exceptions, settings and not adopting a clause are never a cause, a goal or a step. The Debt line says how existing debt is held while the steps are taken; write it last, after the rest of the section. A section that gives only counts, or whose steps are about recording exceptions, is not done.

Stop when every such clause has a section. Report the sections for review before changing code or recording exceptions.
```

Review the draft as you would a design: the causes and the goals are the decisions in it. Commit it beside `disciplines.json`. Every failing check then ends with a `readFirst` line per failing clause that names its section before the rule page's Spirit (step 6); a clause the file does not assess is pointed at the Spirit alone. Record exceptions (step 7) only after the assessment, and note each in the clause's Debt line. Keep the file current: when steps land or a count changes, update the section; when a clause has no findings left, delete its section.

A finished section reads like this:

```markdown
## CD-2#cast-expressions

- **Cause here:** Parsing skipped at a boundary. Database rows are cast to domain types where they are read.
- **Sites:** 118 at 3f1c2ab, in src/orders/ and src/billing/. For example src/orders/order-reader.ts:41, src/billing/invoice-reader.ts:17.
- **Forward goal:** rows are parsed once in the storage port, and services receive typed orders and invoices.
- **Steps:** 1. A schema per table read, in the storage port. 2. The port returns parsed types. 3. Delete the casts, one folder at a time.
- **Debt:** held by the orders team; file carve-outs in discipline-exceptions.json, paid off as each file is touched.
```

## 6. Read the report

The report prints only the sections that have entries, each with its count, then the verdict. A finding line is:

```text
<clause> <mechanism> <file>:<line>:<column> <snippet>
CD-15#loops audit src/basket.ts:15:0 for (const line of this.lines) {
```

Lines are 1-based and columns 0-based. The run passes only when every section except `excluded`, `notAdopted`, `notRun`, `exempted`, `assessment` and `readFirst` is empty. The sections are:

| Section | Meaning and what to do |
| --- | --- |
| `excluded` | the `exclude` entries from `disciplines.json` that were left out of the run; informational, check it is what you meant |
| `notAdopted` | the clauses `disciplines.json` lists as `"not-adopted"`; informational, they were neither run nor projected |
| `notRun` | the clauses `disciplines.json` lists as `"not-run"`, each as `<clause> adopted, mechanism not run: enforced by review`; informational, they were neither run nor projected, and the rule is still owed through review |
| `findings` | violations: fix the code, or record an exception (step 7) |
| `exempted` | findings an exception covers; informational |
| `unrecorded` | a native exception no record holds, as `<clause> <mechanism> <kind> <detail>`: remove it, or record it where step 7 allows. An inline disable, `<clause> eslint inline-disable <file>:<line> <comment>`, and a TypeScript directive, `CD-2#cast-expressions audit inline-disable <file>:<line> <comment>`, are held only by an `authorised-location` or `file-carve-out` on that clause and file. An `eslint-disable` naming no rule escapes every selected clause, needs a record for each, and its lines end ` names no rule and escapes every selected clause: naming the rule is the cheap fix`. A lint-script option, `<clause> eslint command-line-option <package.json> <script> <option> weakens the script's whole run, so no record can cover it: remove it from the script`, cannot be recorded. Where `eslint` shares its script with another command, as in `tsc && eslint -c eslint.config.mjs .`, the line instead reads `<clause> eslint command-line-option <package.json> <script> <option>: <command> is not the only command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as "<invocation>"`: move the call to a script of its own |
| `uncovered` | a mechanical clause of an adopted discipline is not listed: add it to `disciplines.json` with a mechanism, `"not-run"` or `"not-adopted"` |
| `stale` | an exception that no longer exempts anything: delete it |
| `forfeited` | a file carve-out whose file changed since `--base-revision`: fix the file and delete the carve-out |
| `invalidRecords` | an exception entry that cannot be accepted, with the reason, for example `clause-not-run` or `clause-not-adopted` for an entry on a clause listed as `"not-run"` or `"not-adopted"`: correct or delete it |
| `doublyHeld` | a file both authorised and carved out for one clause: keep one |
| `unmeasured` | something could not be measured; each line says what, why and what Hone needs, for example `forfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere` |
| `projectionProblems` | a projection or package slice that differs from what `hone project` writes now, is not written, is not applied, or has no configuration to load it, each with what to do, for example `eslint out-of-date: disciplines.eslint.mjs differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every disciplines.eslint.mjs it writes` |
| `assessment` | a concern this run left to another run, for example `forfeiture elsewhere: 37 file carve-outs not checked for decay in this run`; informational, and the verdict line then reads `verdict: pass (partial assessment)` or `verdict: fail (partial assessment)` |
| `readFirst` | printed last, one line per clause with findings: where to read before changing code, the clause's section in `disciplines.assessment.md` (step 5a) and then the Spirit section of its rule page, for example `CD-15#loops: read the "## CD-15#loops" section of disciplines.assessment.md, then node_modules/@hailstails/hone/rules/CD-15/README.md#spirit`; a clause the file does not assess reads `CD-15#loops: read node_modules/@hailstails/hone/rules/CD-15/README.md#spirit; disciplines.assessment.md does not assess this clause`; before the file is written, one line first says so and names step 5a, and each clause line names its rule page only, as in the walkthrough below; the README lists every line exactly; paths are relative to the `--repo` folder; guidance, it never fails the run |

To print less, set `"reportOutput"` in `disciplines.json` for the repository, or pass `--report-output <output>` for one run, which wins over the file. `full` is the default and prints the report above; `failures-only` leaves out `excluded`, `notAdopted`, `notRun`, `exempted` and `assessment`, and keeps `readFirst`; `counts` prints only each section's heading and count, adding `informational` after `excluded`, `notAdopted`, `notRun`, `exempted` and `assessment` and `guidance` after `readFirst` so every other line names a section that failed the run; `verdict-only` prints only the verdict line. Every output ends in the verdict line, and the exit code is the same whichever output you choose. An unknown value fails the run with exit `2`, as `arguments-invalid` for the option or `file-malformed` for the file.

## 7. Record exceptions

Before recording anything, take the chain in [the spirit of the rules](rules/SPIRIT.md#when-the-check-is-red): measure the sites for each failing clause, ask what each group points at using the rule page's Spirit section and the clause's section in `disciplines.assessment.md` (step 5a), then decide. Fix the cause where you can; exceptions are not the first move. Where a file legitimately needs what a clause forbids, record it in `<repo>/discipline-exceptions.json`:

- `authorised-location`: the clause does not apply to this one file, for example the single adapter that reads the real clock.
- `file-carve-out`: known debt in one file. It is forfeited, and fails the run, as soon as that file changes since `--base-revision`. An `eslint-disable` comment or a `@ts-expect-error`, `@ts-ignore` or `@ts-nocheck` directive already in a file is debt of this kind on the clause it escapes; a new one in a file with no record is `unrecorded`.
- `clause-wide-carve-out`: debt across the whole clause. The rule binds and its check is sound, and the codebase cannot address the debt right now. Its why-chain records why, and the debt has an owner who will pay it down. The check still runs, and a clause-wide carve-out that exempts no finding is `stale`, so record one only while the clause still has findings. Leaving the clause out of `clauses` is not an alternative: it leaves the clause `uncovered`. If the check is not a true measure of the rule here, or cannot work here, list the clause as `"not-run"` instead; if the rule does not apply, list it as `"not-adopted"` (step 4).

Every entry needs a `reason`. By default every entry also needs a `whyChain` shaped like this, with exactly five steps in `whys`:

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

The chain runs cause to cause: each why asks why the answer before it is true, each answer cites evidence that can be checked again, the root names the fifth answer's cause and is checked against today, and the readback runs back from the root to the symptom with "therefore". [The why-chain contract](docs/why-chain-contract.md) has a worked example, the checks Hone runs, and what review still judges. A chain that breaks a check is refused as an `invalidRecords` entry. `file` is an exact repository path.

Debt or authorisations already recorded by an earlier system, for example the old standalone route's `.constitution-carve-outs/`, can be imported with `provenance` instead of a `whyChain`, as [MIGRATING.md](MIGRATING.md#3-convert-the-old-records-into-exceptions) step 3 shows. Imported entries are checked against `--base-revision`: by default, any entry you write or change yourself needs the full `whyChain`.

To record existing debt without a chain on every entry, set `"fileExceptionWhyChains": "optional"` in `disciplines.json`. An `authorised-location` or `file-carve-out` entry may then give only its `reason`, so write the reason as why the exception exists; a blank reason is refused. A run with any file carve-out still needs `--base-revision`, or it reports `forfeiture-unmeasured` and fails. A `clause-wide-carve-out` still needs its `whyChain`, and a `whyChain` or `provenance` you give anyway is still checked. [README.md](README.md#discipline-exceptionsjson) has the details.

## 8. Prove one failure and correction

Before relying on the check, prove that it fails on a real violation in your repository and passes once it is fixed. With CD-17 selected, create `src/discipline-probe.ts` (any path the check covers) containing exactly:

```ts
const probeStartedAt = Date.now();
```

Stage it, since only tracked files are checked, and run the check:

```bash
git add src/discipline-probe.ts
npm run --silent hone:check
```

It must exit `1` with the line `CD-17#clock-sources audit src/discipline-probe.ts:1:0 const probeStartedAt = Date.now();` among its findings. Change the same file to `const probeStartedAt = 0;`, stage it, and run the check again: that finding must be gone. Then remove the probe with `git rm -f src/discipline-probe.ts`. A run that never showed the finding proves nothing: check that the file was staged and is not under an `exclude` entry. For another discipline, take a flag case from its `rules/<ID>/discipline.json`.

## 9. Apply the judgement rules

A judgement clause cannot be selected in `disciplines.json`, and no check reports it. List the judgement rules the repository adopts in the Judgement rules section of `disciplines.assessment.md` (step 5a), so reviewers and agents know to apply them.

Each rule page names its review lens, a method under [methods/lenses/](methods/README.md) for reading code against that kind of rule. To review a change, by a human reviewer or a coding agent:

1. The reviewer is not the change's author. An agent reviewing a change reads files only; it does not edit them.
2. Pin the tree under review to a commit and review that.
3. Run each lens on its own, one concern at a time, without seeing the other lenses' findings. Follow the lens file: load the rule pages that name it, inspect the change as it says, and report findings in its output shape, citing the clause address. A lens covers mechanical rules too, beyond what their checks flag.
4. Run [defended-on-intent](methods/lenses/defended-on-intent.md) last, over the rule text and the other lenses' findings, to catch changes that meet a rule's letter but defeat its intent.
5. Fix each finding. A deliberate departure from a judgement rule is recorded where the review decision is kept, with a `whyChain` in the same shape as step 7.

To use an agent, give it the lens file, the rule pages it names, the change and the pinned commit, and ask it to follow the lens exactly. A single reviewer covering every concern at once misses what separate lenses catch.

## 10. Update and remove

To update, repeat step 2 on a branch with a tarball built from a newer pinned SHA, compare the installed rule pages under `node_modules/@hailstails/hone/rules/` with the old ones, re-run `hone:project` if any clause is `eslint`, run the check, and commit with a message naming the new SHA. Rule text can change between pins, so read the changed pages. Before updating to a pin that has the causal why-chain contract, follow [MIGRATING.md section 8](MIGRATING.md#8-moving-to-causal-why-chains): pass `--base-revision` first, or the update's check reports `legacy-chain-unmeasured`.

To remove, run `npm uninstall @hailstails/hone`, delete the two `hone:` scripts, any vendored tarball, `disciplines.json`, `discipline-exceptions.json`, `disciplines.assessment.md` and, with `eslint` clauses, `disciplines.eslint.mjs` and its spread in the flat config, and take the check out of the validation script.

## Worked example

In the Hone source repository, `tests/test-fixtures/walkthrough/` is a small repository before and after its fix, selecting CD-2, CD-15, CD-17 and CD-23 through the audit, with a `generated/` folder excluded. `tests/walkthrough.integration.test.ts` pins both reports exactly, apart from where the rule pages are (see below).

Before, `npm run --silent hone:check` prints, and exits `1`:

```text
excluded (1)
generated
findings (5)
CD-17#clock-sources audit src/basket.ts:7:0 private openedAt = Date.now();
CD-2#cast-expressions audit src/basket.ts:10:20 entry as Line);   }    total(): string {     let pence = 0;     for (const line …
CD-15#loops audit src/basket.ts:15:0 for (const line of this.lines) {
CD-17#clock-sources audit src/basket.ts:22:0 return Date.now() - this.openedAt;
CD-23#export-test-sibling audit src/utils/format.ts:1:0 missing co-located *.test.ts(x) sibling
readFirst (5)
Start from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.
CD-17#clock-sources: read node_modules/@hailstails/hone/rules/CD-17/README.md#spirit
CD-2#cast-expressions: read node_modules/@hailstails/hone/rules/CD-2/README.md#spirit
CD-15#loops: read node_modules/@hailstails/hone/rules/CD-15/README.md#spirit
CD-23#export-test-sibling: read node_modules/@hailstails/hone/rules/CD-23/README.md#spirit
verdict: fail
```

The test runs against the source repository rather than an install, so the report it pins names the rule pages and the adoption guide from there: `../../../../rules/CD-17/README.md` and `../../../../ADOPTING.md` where an installed package prints `node_modules/@hailstails/hone/rules/CD-17/README.md` and `node_modules/@hailstails/hone/ADOPTING.md`.

The fix replaces the `Basket` class with functions over a readonly `Basket` value, sums with `reduce`, takes the time from an injected `Clock`, types the input instead of casting it, moves `src/utils/format.ts` to `src/format.ts` with a `src/format.test.ts` sibling, and records `src/clock.ts`, the one adapter that reads `Date.now()`, as an authorised location. After, the same command prints, and exits `0`:

```text
excluded (1)
generated
exempted (1)
CD-17#clock-sources audit src/clock.ts:3:0 export const createSystemClock = (): Clock => ({ now: () => Date.now() }); exempted by authorised-location
verdict: pass
```

## Known gaps

- The worked example uses only the audit mechanism. The ESLint consumer in `tests/test-fixtures/consumer-proof/eslint/` is the tested ESLint setup.
- Each check flags exactly what its CHECKS.md says and no more. Where a rule asks for more than its check can see, the page says which part is left to review.
- A snippet is the text the check reports; some checks report a fixed-width window that runs across lines, as CD-2 does above. No snippet is longer than 200 characters: a longer one is cut and ends in `…`. An ESLint finding on a line longer than that, such as a bundled or minified file, shows the line from the finding's column.
- A broken nested `eslint.config.*` in a folder the root config ignores, such as fixtures under `ignores: ["fixtures/**"]`, does not stop the check: those files are reported as `ignore` native exceptions, as the team's own `eslint .` never loads that config. One pattern shape is taken for a folder ignore although it is not one: an ignore matching every entry directly inside the folder, such as `gen/*`, where the team's ESLint still enters `gen` and fails on its broken config.
- The disciplines' IDs and rule text come from one team's code-discipline set. Selecting a subset is supported; editing a shipped rule is not. Write your own rule set for different rules, following [docs/extending.md](docs/extending.md).
