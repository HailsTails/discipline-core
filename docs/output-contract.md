# Output contract

This page lists everything the `hone` command prints, exactly as it prints it: the help, the version, the report, the load failures and the `hone project` lines. Hooks, CI jobs and agents can rely on what it marks stable. [Compatibility](../README.md#compatibility) says which releases may change it.

A test renders every kind of line the command can print and checks each against the lines on this page, both ways: a line Hone can print that is not listed here fails the build, and so does a line listed here that Hone cannot print.

## Stable and not stable

Stable, so changing it is a major release:

- the command names, option names, option values and exit codes;
- the report's section names, their order and roles, the heading and count lines, the output modes and the verdict lines;
- in every line below, the fixed words, the order of the values and what separates them, except where this page says the text is not stable;
- the load failure kinds, and the values before each `<detail>`.

Not stable, so a minor release may change it:

- the help text;
- the text in a `<detail>`, which comes from Node, git, ESLint or a schema check;
- the wording after `load failure: arguments-invalid`, which is written for the person who typed the command;
- the `readFirst` lines and their leading note, which are guidance for a person: a tool can read the clause address before the first `: ` of a clause line and nothing more;
- a snippet, which is the source text at the finding;
- the words of an `unmeasured` or `projectionProblems` line after its kind, mechanism and path, which may gain the next step to take.

A minor release may add a section, a kind of line in a section, a load failure kind, an option or a command. A tool reading the report should pass over a section heading or a line kind it does not know.

## Reading the lines

In the tables below, a word in angle brackets, such as `<clause>`, stands for a value; everything else is printed as shown. Every line ends with a line feed. A value that holds a line break, such as a snippet, prints it as `\n` or `\r`, so each entry stays on one line. Paths are printed relative to the `--repo` folder, with forward slashes, unless they are on another drive.

| Value | Printed as |
| --- | --- |
| `<clause>` | a clause address: `CD-15#loops` for Hone's own rule set, `<rule set>/<ID>#<clause>` for a team's |
| `<mechanism>` | a mechanism id, such as `audit` or `eslint` |
| `<file>`, `<path>` | a path |
| `<line>`, `<column>` | a 1-based line and a 0-based column |
| `<count>`, `<index>` | a whole number; an `<index>` counts from 0 |

## Commands

```text
hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone --help
hone --version
```

Each option is followed by its value as the next argument. `--help` or `-h` anywhere after a command prints that command's help instead of running it. Help and the version go to standard output and exit `0`.

| Exit | `hone check` | `hone project` |
| --- | --- | --- |
| `0` | the verdict is `pass`, or help or the version was printed | every projection was written or already current, or help was printed |
| `1` | the verdict is `fail` | not used |
| `2` | a load failure: an input could not be loaded, or a mechanism failed or returned invalid output | a load failure |

`hone --help` prints:

```text
usage: hone <command> [options]

Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.

commands:
  check    check the repository against the disciplines it selects and print the report, ending in its verdict
  project  write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --help, -h  print this help; after a command, print that command's help
  --version   print the installed version of @hailstails/hone

run hone <command> --help for a command's options and exit codes
```

`hone check --help` prints:

```text
usage: hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]

check the repository against the disciplines it selects and print the report, ending in its verdict

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no file carve-out can be forfeited
  --report-output <full|failures-only|counts|verdict-only>
      how much of the report to print, over reportOutput in disciplines.json; full when neither is set
  --forfeiture <this-run|elsewhere>
      assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  the verdict is pass
  1  the verdict is fail
  2  an input could not be loaded, or a mechanism failed or returned invalid output
```

`hone project --help` prints:

```text
usage: hone project --repo <dir>

write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  every projection was written or already current
  2  any failure
```

`hone --version` prints the version of the installed package, read from its `package.json`:

| Output | Line |
| --- | --- |
| `version` | `<version>` |

## The report

`hone check` prints the report's non-empty sections in this order, then the verdict line. A failing section makes the verdict `fail`; an informational or guidance section never does.

| Section | Role | What it lists |
| --- | --- | --- |
| `excluded` | informational | paths that `exclude` in `disciplines.json` leaves out |
| `notAdopted` | informational | clauses marked `not-adopted` |
| `notRun` | informational | clauses marked `not-run` |
| `findings` | failing | each place a clause is broken |
| `exempted` | informational | findings an exception covers, with the exceptions that cover them |
| `uncovered` | failing | clauses of a selected discipline that are neither selected nor marked |
| `stale` | failing | exceptions that cover no finding |
| `forfeited` | failing | file carve-outs on files this change touched |
| `unrecorded` | failing | native exceptions with no record in `discipline-exceptions.json` |
| `doublyHeld` | failing | files both authorised and carved out for one clause |
| `invalidRecords` | failing | entries in `discipline-exceptions.json` that cannot be applied |
| `unmeasured` | failing | what this run could not measure |
| `projectionProblems` | failing | ESLint projections that are out of date |
| `assessment` | informational | concerns this run left to another run |
| `readFirst` | guidance | where to read before changing code, for each clause with findings |

`--report-output`, or `reportOutput` in `disciplines.json`, sets how much is printed. The verdict and the exit code are the same in every output.

| Output | Prints |
| --- | --- |
| `full` | each non-empty section's heading and entries, then the verdict line |
| `failures-only` | the same without the informational sections |
| `counts` | each non-empty section's heading only, with its role after an informational or guidance section, then the verdict line |
| `verdict-only` | the verdict line |

A section heading counts its entries. In `counts`, an informational or guidance section's heading names its role. The `readFirst` count includes its leading note line when there is one.

| Line | Template |
| --- | --- |
| `heading` | `<section> (<count>)` |
| `heading` | `<section> (<count>) informational` |
| `heading` | `<section> (<count>) guidance` |
| `verdict` | `verdict: pass` |
| `verdict` | `verdict: fail` |
| `verdict` | `verdict: pass (partial assessment)` |
| `verdict` | `verdict: fail (partial assessment)` |

The verdict line reads `(partial assessment)` whenever the report has an `assessment` section.

## Report lines

Each section's entries take one of these shapes. An exempted finding repeats ` exempted by <record kind>` once for each exception that covers it. In `projectionProblems`, a `<slice>` is the `disciplines.eslint.mjs` projection file of one config root, the repository root or a folder in `eslintConfigRoots`; `unconfigured` means that root has no `eslint.config.*`. `<folders>` lists folders separated by `, `.

| Section | Line |
| --- | --- |
| `excluded` | `<path>` |
| `notAdopted` | `<clause>` |
| `notRun` | `<clause> adopted, mechanism not run: enforced by review` |
| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet>` |
| `exempted` | `<clause> <mechanism> <file>:<line>:<column> <snippet> exempted by <record kind>` |
| `exempted` | `<clause> <mechanism> <file>:<line>:<column> <snippet> exempted by <record kind> imported from <source>` |
| `uncovered` | `<clause>` |
| `stale` | `<clause> <mechanism> authorised-location <file>` |
| `stale` | `<clause> <mechanism> file-carve-out <file>` |
| `stale` | `<clause> <mechanism> clause-wide-carve-out *` |
| `forfeited` | `<clause> <mechanism> file-carve-out <file>` |
| `unrecorded` | `<clause> <mechanism> ignore <file>` |
| `unrecorded` | `<clause> <mechanism> config-override <file>` |
| `unrecorded` | `<clause> <mechanism> suppression-entry <file> <suppressions file>` |
| `unrecorded` | `<clause> <mechanism> inline-disable <file>:<line> <comment>` |
| `unrecorded` | `<clause> <mechanism> inline-rule-config <file>:<line> <comment>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>` |
| `doublyHeld` | `<clause> <mechanism> doubly-held <file>` |
| `invalidRecords` | `exceptions[<index>] clause-unparseable <detail>` |
| `invalidRecords` | `exceptions[<index>] clause-not-selected <clause>` |
| `invalidRecords` | `exceptions[<index>] clause-not-adopted <clause>` |
| `invalidRecords` | `exceptions[<index>] clause-not-run <clause>` |
| `invalidRecords` | `exceptions[<index>] file-not-repo-path <file>` |
| `invalidRecords` | `exceptions[<index>] why-chain-refused <detail>` |
| `invalidRecords` | `exceptions[<index>] evidence-refused <detail>` |
| `invalidRecords` | `exceptions[<index>] import-unverified <detail>` |
| `invalidRecords` | `exceptions[<index>] non-exemptible-clause <clause>` |
| `invalidRecords` | `exceptions[<index>] duplicate of <index>` |
| `unmeasured` | `forfeiture-unmeasured` |
| `unmeasured` | `import-unmeasured` |
| `unmeasured` | `legacy-chain-unmeasured` |
| `unmeasured` | `mechanism-not-run <mechanism> missing` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included; not managed from this repository, each holding its own disciplines.json: <folders>; nested Hone configurations are not supported yet, see https://github.com/HailsTails/hone/issues/72` |
| `projectionProblems` | `<mechanism> out-of-date` |
| `projectionProblems` | `<mechanism> out-of-date <slice>` |
| `projectionProblems` | `<mechanism> missing <slice>` |
| `projectionProblems` | `<mechanism> not-applied <slice>` |
| `projectionProblems` | `<mechanism> unconfigured <slice>` |
| `assessment` | `forfeiture elsewhere: 1 file carve-out not checked for decay in this run` |
| `assessment` | `forfeiture elsewhere: <count> file carve-outs not checked for decay in this run` |
| `readFirst` | `Start from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; <adoption guide>#5a-write-the-assessment says how to write it.` |
| `readFirst` | `disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; <adoption guide>#5a-write-the-assessment says how to write it.` |
| `readFirst` | `Start from each rule's Spirit below. disciplines.assessment.md could not be read.` |
| `readFirst` | `disciplines.assessment.md could not be read.` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md, then <rule page>#spirit` |
| `readFirst` | `<clause>: read <rule page>#spirit; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: read <rule page>#spirit` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md; its rule set has no rule page at <rule page>` |
| `readFirst` | `<clause>: its rule set has no rule page at <rule page>; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: its rule set has no rule page at <rule page>` |

`readFirst` has one clause line per clause with findings, in the order the findings first name them. When `disciplines.assessment.md` is not written yet, or cannot be read, one note line comes first; it starts with `Start from each rule's Spirit below.` only when at least one clause line names a rule page. The `<adoption guide>` is `ADOPTING.md` in the installed package, such as `node_modules/@hailstails/hone/ADOPTING.md`. A clause line names the clause's section in `disciplines.assessment.md` when the file has one, says `does not assess this clause` when the file is there without that section, and says neither when the file is not read. [The README](../README.md#commands) says how a section is matched.

## Load failures

A run that cannot load its inputs, or whose mechanism fails, prints one line and exits `2`. It prints the same line in every output.

| Kind | Line |
| --- | --- |
| `arguments-invalid` | `load failure: arguments-invalid <detail>` |
| `install-root-unresolvable` | `load failure: install-root-unresolvable <url> <detail>` |
| `file-unreadable` | `load failure: file-unreadable <path> <detail>` |
| `file-malformed` | `load failure: file-malformed <path> <detail>` |
| `unsupported-version` | `load failure: unsupported-version <path> <version found>` |
| `reserved-rule-set-name` | `load failure: reserved-rule-set-name <rule set>` |
| `rule-set-name-collision` | `load failure: rule-set-name-collision <rule set> <other rule set>` |
| `duplicate-clause` | `load failure: duplicate-clause <clause> <clause with its rule set>` |
| `unknown-rule-set` | `load failure: unknown-rule-set <rule set>` |
| `unknown-discipline` | `load failure: unknown-discipline <clause>` |
| `unknown-clause` | `load failure: unknown-clause <clause>` |
| `judgement-clause-selected` | `load failure: judgement-clause-selected <clause>` |
| `judgement-clause-listed` | `load failure: judgement-clause-listed <clause>: a judgement clause is enforced by review and is left out of clauses, adopted or not; remove it` |
| `mechanism-not-allowed` | `load failure: mechanism-not-allowed <clause> <mechanism>` |
| `runner-missing` | `load failure: runner-missing <mechanism>` |
| `runner-invalid` | `load failure: runner-invalid <mechanism> <detail>` |
| `piece-missing` | `load failure: piece-missing <clause> <mechanism>` |
| `rule-set-invalid` | `load failure: rule-set-invalid <path> <detail>` |
| `git-failed` | `load failure: git-failed <detail>` |
| `config-root-untracked` | `load failure: config-root-untracked <config root>: an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in disciplines.json` |
| `runner-failed` | `load failure: runner-failed <mechanism> piece-invalid <piece folder> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unreadable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unparseable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> tool-failed <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> plugin-conflict <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> team-config-unloadable <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> runner-invalid-output <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>: add a supported version to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found not installed, supported <range>: <package> is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>; <package> found <version found>, supported <range>: add a supported version of each to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-shadowed <package> resolved from <location> inside the core install <install folder>: delete <install folder>/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used` |

The last `toolchain-unavailable` line lists every unavailable package, separated by `; `.

An `arguments-invalid` line says what was wrong with the command as typed. Its wording is not stable.

| Problem | Line |
| --- | --- |
| `command-missing` | `load failure: arguments-invalid hone needs a command, check or project; run hone --help for usage` |
| `command-unknown` | `load failure: arguments-invalid hone has no command "<given>"; its commands are check and project; run hone --help for usage` |
| `argument-unexpected` | `load failure: arguments-invalid hone <command> takes options, not "<given>" on its own; give each option and its value as two arguments, as in --repo <dir>; run hone <command> --help for its options` |
| `option-unknown` | `load failure: arguments-invalid hone <command> has no option "<given>"; run hone <command> --help for its options` |
| `option-joined` | `load failure: arguments-invalid give <option> and its value as two arguments, as in <option> <value>, not "<given>"` |
| `value-missing` | `load failure: arguments-invalid <option> needs a value, as in <option> <value>` |
| `option-repeated` | `load failure: arguments-invalid <option> is given more than once; give it once` |
| `option-required` | `load failure: arguments-invalid hone <command> needs --repo <dir>: the folder that holds disciplines.json, usually the repository root` |
| `choice-invalid` | `load failure: arguments-invalid <option> takes <values>, not "<given>"` |
| `option-removed` | `load failure: arguments-invalid removed: "--waived-clauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12` |
| `repo-unresolvable` | `load failure: arguments-invalid --repo <dir> resolves to no absolute path` |
| `selection-absent` | `load failure: arguments-invalid --repo <dir> holds no disciplines.json; give the folder that holds it, usually the repository root` |

## hone project

`hone project` prints one line per projection file it manages, and nothing when no selected mechanism needs one.

| Output | Line |
| --- | --- |
| `project` | `<path> written` |
| `project` | `<path> unchanged` |
| `project` | `<path> removed` |
| `project` | `<path> left-in-place` |
