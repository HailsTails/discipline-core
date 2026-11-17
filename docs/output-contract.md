# Output contract

This page lists everything the `hone` command prints, exactly as it prints it: the help, the version, the report, the load failures and the `hone project` lines. It says which parts a hook, CI job or agent can parse and rely on. [Compatibility](../README.md#compatibility) says which releases may change them.

A test renders every kind of line the command can print, fills each template below with that line's own sample values, and requires the result to equal the printed line exactly: a line Hone can print that is not listed here fails the build, and so does a line listed here that Hone cannot print. The synopsis and help blocks below are compared with what the command prints, character for character.

## Streams and exit codes

Hone prints everything to standard output: the report, the help, the version, `hone project` lines and every load failure, including an error Hone did not expect. Hone writes nothing to standard error itself; Node can write its own warnings there, so a hook should not read output on standard error as a failure.

The exit code is the signal a hook should act on:

- `0`: `hone check` printed `verdict: pass` or `verdict: pass (partial assessment)`, `hone project` wrote or confirmed every projection, or help or the version was printed;
- `1`: `hone check` printed `verdict: fail` or `verdict: fail (partial assessment)` as its last line. Exit `1` always comes with one of those lines, and with nothing else;
- `2`: Hone could not decide. It printed exactly one line, starting with `load failure: `, and no verdict. That covers a command typed wrongly, an input that could not be loaded, a mechanism that failed, and an error Hone did not expect, which prints as `unexpected-error`.

A 1.0 hook can rely on this: run `hone check`, block on any non-zero exit, and show standard output as it came.

## What a tool can parse

A tool can rely on these, and a change to any of them is a major release:

- the command names, option names, option values, exit codes and streams above;
- the verdict line, which is always the last line of a `hone check` report and is one of the four lines under [The report](#the-report);
- the section names, their order and roles, the heading and count lines, and the output modes;
- the first word of a load failure after `load failure: `, its kind;
- in each line below, the fixed words and values up to the first value that may hold a space, and the single spaces between them.

The values in the [table of values](#values) marked "may hold a space" can contain spaces, and Hone does not quote or escape them. Everything from the first such value to the end of the line is one piece of text: a tool cannot split it into fields, and should not try. For a finding, a tool can read the clause and the mechanism; the file, position and snippet that follow are for a person. Hone has no machine-readable report yet, so a tool that needs each finding's file and position has nothing stable to read them from.

These are not stable, so a minor release may change them:

- the help text, though the synopsis and the exit codes it lists are stable;
- the text of a `<detail>`, which comes from Node, git, ESLint or a schema check;
- the wording after `load failure: arguments-invalid`, written for the person who typed the command;
- the text after a load failure's values, which says what to do next: the repair text of `selection-absent`, `judgement-clause-listed` and `config-root-untracked`, and everything after the kind in `toolchain-unavailable` and `toolchain-shadowed`;
- the `readFirst` lines and their leading note, written for a person;
- the words of an `unmeasured` or `projectionProblems` line after the `:` that ends its leading fields (its kind and reason, or its mechanism, state and slice), which say why and what to do next.

A minor release may add a section, a kind of line in a section, a load failure kind, an option or a command. A tool reading the report should pass over a section heading or a line kind it does not know.

## Values

In the tables below, a word in angle brackets, such as `<clause>`, stands for a value; everything else is printed as shown. Every line ends with a line feed. A value that holds a line break prints it as `\n` or `\r`, so each entry and each load failure stays on one line.

| Value | Printed as | Space |
| --- | --- | --- |
| `<clause>` | in the report, a clause address: `CD-15#loops` for Hone's own rule set, `<rule set>/<ID>#<clause>` for a team's; in a load failure, the address as written in `disciplines.json` | never in the report; may hold a space in a load failure |
| `<mechanism>` | a mechanism id, such as `audit` or `eslint` | never |
| `<record kind>`, `<section>`, `<package>` | a word from the lines below, a section name, or an npm package name | never |
| `<line>`, `<column>` | a 1-based line and a 0-based column | never |
| `<count>`, `<index>`, `<earlier index>` | a whole number; an index counts from 0 | never |
| `<version>` | the installed package's version | never |
| `<file>`, `<path>`, `<slice>`, `<suppressions file>`, `<package file>`, `<config root>`, `<piece folder>`, `<location>`, `<install folder>`, `<rule page>`, `<adoption guide>` | a path, as described below | may hold a space |
| `<folders>` | paths separated by `, ` | may hold a space |
| `<folder>` | the folder that holds a `<slice>` | may hold a space |
| `<project command>` | the command that runs `hone project` for this repository: `node`, the installed command's absolute path, `project --repo` and the repository's absolute path, each path with forward slashes and in double quotes when it holds a character other than a letter, digit or one of `_ . / @ : + -` | may hold a space |
| `<revision>`, `<git message>` | the `--base-revision` value as given and what git said, each as a JSON string in double quotes | may hold a space |
| `<dir>` | the `--repo` value as typed | may hold a space |
| `<url>` | the module URL Hone could not resolve, as given | may hold a space |
| `<snippet>` | the source text at a finding: at most 200 characters, or the first 200 followed by `…` when it is longer | may hold a space |
| `<comment>`, `<script>`, `<option>`, `<source>` | the native exception's comment, the `package.json` script name and the option in it, or where an imported record came from | may hold a space |
| `<detail>`, `<given>`, `<values>`, `<rule set>`, `<other rule set>`, `<clause with its rule set>`, `<version found>`, `<other package>`, `<range>` | text from the input, a tool or the command as typed | may hold a space |

Paths are printed with forward slashes. A path inside the `--repo` folder is printed relative to it, in the report and in load failures alike. A path outside it is printed absolute, such as `C:/Users/me/shared/rule.json` on Windows. A load failure from before `--repo` is resolved names the folder as typed (`<dir>`). A load failure reading the installed package's own `package.json`, which only `hone --version` reads, prints its absolute path. A path inside a `<detail>` is printed however the tool that wrote the detail printed it.

## Commands

```text
hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone --help
hone --version
```

Each option is followed by its value as the next argument; a value that starts with `-` is read as a missing value. `--help` or `-h` after a command prints that command's help instead of running it, and `hone --help <command>` prints the same. `hone --help` and `hone --version` take nothing else after them.

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
  2  a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly
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

`hone --version` prints the version of the installed package, read from its `package.json`, and exits `0`:

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

Each section's entries take one of these shapes. An exempted finding repeats ` exempted by <record kind>` once for each exception that covers it. In `projectionProblems`, a `<slice>` is the `disciplines.eslint.mjs` projection file of one config root, the repository root or a folder in `eslintConfigRoots`; `unconfigured` means that root has no `eslint.config.*`.

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
| `unrecorded` | `<clause> <mechanism> inline-disable <file>:<line> <comment> names no rule and escapes every selected clause: naming the rule is the cheap fix` |
| `unrecorded` | `<clause> <mechanism> inline-rule-config <file>:<line> <comment>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option> weakens the script's whole run, so no record can cover it: remove it from the script` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>: <command> is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as <invocation>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>: <wrapper> comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` |
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
| `invalidRecords` | `exceptions[<index>] duplicate of <earlier index>` |
| `unmeasured` | `forfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere` |
| `unmeasured` | `forfeiture-unmeasured base-git-failed <revision>: git could not list the files changed since that revision and said <git message>; Hone needs that revision and the history back to where this branch left it, or leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere` |
| `unmeasured` | `import-unmeasured no-base-revision: no --base-revision was given, so imported records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main` |
| `unmeasured` | `import-unmeasured base-git-failed <revision>: git could not read the exception records at that revision and said <git message>; Hone needs the exception records as they were at that revision` |
| `unmeasured` | `legacy-chain-unmeasured no-base-revision: no --base-revision was given, so legacy-chain records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main` |
| `unmeasured` | `legacy-chain-unmeasured base-git-failed <revision>: git could not read the exception records at that revision and said <git message>; Hone needs the exception records as they were at that revision` |
| `unmeasured` | `mechanism-not-run <mechanism> missing: disciplines.<mechanism>.mjs is not written; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <mechanism> lines under projectionProblems name the package slices involved` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; <folders> hold their own disciplines.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run <project command>, which writes its slice` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <mechanism> lines under projectionProblems name the package slices involved; <folders> hold their own disciplines.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run <project command>, which writes its slice` |
| `projectionProblems` | `<mechanism> out-of-date: disciplines.<mechanism>.mjs differs from what hone project writes now; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> out-of-date <slice>: that slice differs from what hone project writes now; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> missing <slice>: that slice is not written; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> not-applied <slice>: the <mechanism> configuration for <folder> leaves records of that slice out of effect; spread the default export of <slice> last in that package's configuration, in place of any other projection it spreads, or, where a tool such as sku generates the configuration, last in the configuration the tool takes` |
| `projectionProblems` | `<mechanism> unconfigured <slice>: <folder> has no <mechanism> configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check` |
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

`readFirst` has one clause line per clause with findings, in the order the findings first name them. When `disciplines.assessment.md` is not written yet, or cannot be read, one note line comes first; it starts with `Start from each rule's Spirit below.` only when at least one clause line names a rule page. A clause line's first word is a clause address, which holds a `#`, followed by `:`; a note line's first word holds no `#`, which is how a tool tells them apart. The `<adoption guide>` is `ADOPTING.md` in the installed package, such as `node_modules/@hailstails/hone/ADOPTING.md`. A clause line names the clause's section in `disciplines.assessment.md` when the file has one, says `does not assess this clause` when the file is there without that section, and says neither when the file is not read. [The README](../README.md#commands) says how a section is matched.

## Load failures

A run that cannot decide prints one line and exits `2`. It prints the same line in every output. The line starts with `load failure: ` and its kind; the values follow in the order shown, and any text after the values is not stable.

| Kind | Line |
| --- | --- |
| `arguments-invalid` | `load failure: arguments-invalid <detail>` |
| `selection-absent` | `load failure: selection-absent <dir> holds no disciplines.json; give the folder that holds it, usually the repository root` |
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
| `unexpected-error` | `load failure: unexpected-error <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> piece-invalid <piece folder> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unreadable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unparseable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> tool-failed <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> plugin-conflict <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> team-config-unloadable <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> runner-invalid-output <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>: add a supported version to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found not installed, supported <range>: <package> is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>; <other package> found <version found>, supported <range>: add a supported version of each to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-shadowed <package> resolved from <location> inside the core install <install folder>: delete <install folder>/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used` |

The last `toolchain-unavailable` line lists every unavailable package, separated by `; `. An `unexpected-error` is a fault in Hone, not in the repository; its `<detail>` is the error's message.

An `arguments-invalid` line says what was wrong with the command as typed. Its wording is not stable.

| Problem | Line |
| --- | --- |
| `command-missing` | `load failure: arguments-invalid hone needs a command, check or project; run hone --help for usage` |
| `command-unknown` | `load failure: arguments-invalid hone has no command "<given>"; its commands are check and project; run hone --help for usage` |
| `flag-extra` | `load failure: arguments-invalid hone <flag> takes nothing after it, not "<given>"; run hone --help for usage` |
| `argument-unexpected` | `load failure: arguments-invalid hone <command> takes options, not "<given>" on its own; give each option and its value as two arguments, as in <option> <value>; run hone <command> --help for its options` |
| `option-unknown` | `load failure: arguments-invalid hone <command> has no option "<given>"; run hone <command> --help for its options` |
| `option-joined` | `load failure: arguments-invalid give <option> and its value as two arguments, as in <option> <value>, not "<given>"` |
| `value-missing` | `load failure: arguments-invalid <option> needs a value, as in <option> <value>` |
| `option-repeated` | `load failure: arguments-invalid <option> is given more than once; give it once` |
| `option-required` | `load failure: arguments-invalid hone <command> needs --repo <dir>: the folder that holds disciplines.json, usually the repository root` |
| `choice-invalid` | `load failure: arguments-invalid <option> takes <values>, not "<given>"` |
| `option-removed` | `load failure: arguments-invalid removed: "--waived-clauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12` |
| `repo-unresolvable` | `load failure: arguments-invalid --repo <dir> resolves to no absolute path` |

## hone project

`hone project` prints one line per projection file it manages, and nothing when no selected mechanism needs one.

| Output | Line |
| --- | --- |
| `project` | `<path> written` |
| `project` | `<path> unchanged` |
| `project` | `<path> removed` |
| `project` | `<path> left-in-place` |
