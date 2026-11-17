# Changelog

Every release of Hone, newest first. `pnpm run release-pull-request` writes each new section from the commits merged to `main` since the previous release tag, whose subjects are the squash-merged pull request titles; README.md's Compatibility section says what each kind of release may change. The sections below were written by hand from the merged pull requests when the changelog started.

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
