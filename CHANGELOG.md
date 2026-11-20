# Changelog

Every release of Hone, newest first. `pnpm run release-pull-request` writes each new section from the commits merged to `main` since the previous release tag, whose subjects are the squash-merged pull request titles; README.md's Compatibility section says what each kind of release may change. The sections below were written by hand from the merged pull requests when the changelog started.

## 1.5.0

### Features

- add the TypeScript symptom catalogue and its typed reader (#199)
- prune-debt removes paid debt on a file that still exists (#203)
- a finding names its symptom (#202)

### Other changes

- pages for principles, cases, rules, records and the TypeScript layer (#197)
- numbered rule pages point at the named pages (#201)
- the install-proof plan test holds no debt (#208)

## 1.4.0

### Features

- a CD-27 test-body-logic finding names the allowed form for what it flagged, and CHECKS.md shows each one, proven against every audit and ESLint clause Hone ships (#171)
- list paid ESLint debt as stale, and add hone prune-debt to remove the records of deleted files (#191)

### Fixes

- CD-41 function-length does not measure a test suite's describe body (#170)
- a CD-27 test-body-logic finding on JSON.stringify or JSON.parse points at CD-19 (#186)

### Other changes

- Hone's ESLint pieces observe sites through one boundary over ESLint's rule contract (#166)
- the ESLint runner reads lint messages and source lines through two units of their own (#177)
- CD-25 names stubs and spies with written-out answers as a unit test's doubles, and reads a double that needs behaviour as a finding (#180)
- hone check's measurement rules move from run-check into a unit of their own (#179)
- the ESLint runner reads its repository through readers named for what it asks, and its tests stub them (#181)
- CD-17, CD-27, CD-12 and the review lenses name a stub where they offered a fake clock or an in-memory fake (#188)
- hone check takes its selection through a repository, and its orchestration tests pass written-out objects (#183)

## 1.3.0

### Features

- debt records need no reason or why-chain (#147)
- record-debt skips files the ESLint projection cannot reach (#153)

### Fixes

- pass over a package.json script whose quotes do not pair, and list one naming eslint as an unreadable command-line-option (#139)

### Other changes

- keep Hone's own exception records in the split layout (#140)
- run CD-27 test-body-logic and the CD-3 clauses at edition 2, and record Hone's backlog as debt (#157)

## 1.2.0

### Features

- add CD-3 edition 2, judging the options a tsconfig.json resolves to through extends, and a required disk on the experimental audit WalkerRepository (#136)

## 1.1.0

### Features

- add hone record-debt, which writes an adopting repository's existing findings as reason-only file carve-outs (#132)
- ship a tightened check as a clause edition, with CD-27 test-body-logic edition 2 behind checkEditions (#133)
- keep exception records in a file per rule and kind, with hone split-records to migrate (#134)

### Other changes

- point the README badges and install text at the latest dist-tag (#129)
- build the package once on the release's environment and prove that tarball on Windows and Linux (#130)

## 1.0.0

### Other changes

- size each release by plain semver so a stable release leaves the zero major (#120)

## 0.1.0-pre.9

### Fixes

- publish zod, jsonc-parser and @eslint/plugin-kit as caret-range dependencies instead of bundling them (#125)

## 0.1.0-pre.8

### Fixes

- accept a leading --, print short package paths under pnpm and ship the changelog (#122)

### Other changes

- guide migrations through old-route settings, pnpm commands and exact pins (#121)

## 0.1.0-pre.7

### Features

- export folderScope and an experimental testing entry so a team can test its audit pieces from the package (#117)

### Other changes

- release: release on merge of the release pull request instead of a hand-pushed tag (#116)

## 0.1.0-pre.6

### Breaking changes

- let a clause be adopted with its mechanism not run, and remove assessment.waivedClauses and --waived-clauses (#92)
- eslint: write a projection slice per config root, with core-validated eslintConfigRoots (#86)
- cli: add --help and --version, word argument errors for the person typing, and document every printed line in a tested output contract (#96)
- let file records hold inline disables and TypeScript directives, and judge lint-script options by effect (#97)
- eslint: add CD-2#non-null-assertions for non-null and definite assignment assertions (#109)

### Features

- point each failing clause at its assessment section and its rule's Spirit at the end of a red check (#93)

### Fixes

- reserve not-adopted from mechanism ids and make its refusals say what to do (#85)
- name every missing ESLint peer, the broken ESLint config and its fix, and cap report snippets (#83)
- eslint: treat files under a broken nested ESLint config that a governing config ignores as ignored, as the team's ESLint does (#91)
- say why a check could not measure and what to run next (#94)

### Other changes

- deps: bump zod from 4.4.3 to 4.6.6 in the npm_and_yarn group across 1 directory (#54)
- give every rule a spirit page and move check mechanics to CHECKS.md (#87)
- an assessment of what each high-count clause means, written at adoption (#90)
- state how config files and clause mechanisms change across versions (#108)
- install every install-proof consumer with pnpm (#105)

## 0.1.0-pre.5

### Breaking changes

- raise the ESLint 9 peer floor to 9.28.0, the first with every bulk-suppressions option (#63)
- make the public type entries safe to call stable (#62)
- let a repository list the packages CD-19 confines, confining none by default (#66)
- permit only const assertions, read any from the type, and require tracked references on type directives (#76)

### Features

- let a run leave carve-out forfeiture to another run with assessment.forfeiture and --forfeiture (#64)
- eslint: group the projection's file records by clause set; run hone project and commit the result (#74)
- let a run leave waived clauses unrun with assessment.waivedClauses and --waived-clauses (#73)
- let disciplines.json mark a clause not-adopted, so it is neither run nor projected (#81)

### Other changes

- add the ESLint runner's internal scope set, proven to leave the report unchanged (#68)
- add the team rule set guide and prove it from a packed install (#69)

## 0.1.0-pre.4

### Breaking changes

- raise the Node floor to 22.18, test macOS and Node 24, add a security policy (#42)

### Features

- require team ESLint plugin namespaces to follow their rule set (#40)
- accept the hone/ owner prefix for the tool's own rule set (#39)
- release: add a compatibility policy, a changelog and release tooling (#44)
- publish typed entries @hailstails/hone/rule-set and experimental @hailstails/hone/audit (#60)

### Fixes

- make the pnpm lock reader fail on inline snapshots and dependency sections (#56)
- let hone check finish on large repositories without changing its report (#58)

### Other changes

- Keep versions out of the docs and guard against them coming back (#20)
- declare the authoring types without zod so they can be published (#49)
- move Hone's own repository from bun to pnpm (#50)
- add package and repository hygiene files (#57)

## 0.1.0-pre.3

### Other changes

- Stage npm releases for owner approval instead of publishing them (#19)

## 0.1.0-pre.2

### Breaking changes

- Rename the npm package from `honed` to `@hailstails/hone`; MIGRATING.md section 11 has the steps (#13)

### Other changes

- Prepare the package for npm trusted publishing (#9)
- Run the npm publish job in the npm environment (#12)
- Make `typescript` a required peer (#17)
- Reword the seven CD-19 authorised-location records for this repository (#18)

## 0.1.0-pre.1

### Features

- The first pre-release: one `hone` command with `check` and `project` subcommands, released as a tarball for the npm package `honed` (#4)
- Run Hone's own disciplines on Hone in CI (#3)

### Other changes

- Point the install steps at this repository (#1)
- Carry Hone's CD-19 authorised locations from the earlier record (#2)
- Write the release text from the tool identity, prove the package before release, and give the reserved ESLint namespace its own field (#5)
