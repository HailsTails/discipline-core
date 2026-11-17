# Changelog

Every release of Hone, newest first. `bun run release-pull-request` writes each new section from the pull request titles merged since the previous release tag; README.md's Compatibility section says what each kind of release may change. The sections below were written by hand from the merged pull requests when the changelog started.

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
