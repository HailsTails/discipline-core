# CD-47 checks

Symptom: [Inherited environment in a subprocess](../typescript/symptoms.md#inherited-environment-in-a-subprocess).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-47#hermetic-git-spawns` | audit | a git spawn in a test without a hermetic `env` |

## What the check flags
- Test files: `*.test.ts`, `*.test.tsx`, `*.test.mjs`, `*.test.js`, `*.spec.ts`, `*.spec.mjs`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder can be left out with `exclude` in disciplines.json.
- A line calling `spawnSync`, `spawn`, `execFileSync`, `execFile`, `execSync`, `exec`, `execa` or `execaSync` with `"git"` (or `'git'`, or a template literal) as the first argument.
- Allowed when, within that line and the next seven, an `env:` names `hermeticGitEnvironment`, `withoutInheritedGitBindings` or `environment`, and no nearby `env:` uses `process.env`. The environment comes from a unit of ours with its own test, not a test helper.
- Not detected: a command string such as `execSync("git status")`, a split call, or a non-literal command. Whether the spawn is warranted at all is left to review.

## Example violation
```ts
spawnSync("git", ["init"], { cwd: directory });
```

## How to fix
```ts
spawnSync("git", ["init"], { cwd: directory, env: hermeticGitEnvironment() });
```
Build the environment without inherited git variables or the user's configuration, and run in a temporary directory.

## Exceptions
Record exemptions only in `discipline-exceptions.json` at the repository root; core reads no other allowance file. Use `authorised-location` when a test file legitimately builds its environment another way. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-47#hermetic-git-spawns", "file": "test/git-fixture.test.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`, which will be refused in the next major release. [The exceptions format](../../README.md#discipline-exceptionsjson) gives each shape.
