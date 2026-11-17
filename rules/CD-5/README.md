# CD-5: No comments, no JSDoc

## Rule

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-5#comments-directives` | audit | TODOs, linter directives and `@ts-expect-error` without a tracker |

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `// TODO` not followed, after optional spaces, by a tracked reference, for example `// TODO(#42) ...`.
- A comment starting with `biome-ignore`, `eslint-disable`, `eslint-enable`, `eslint-disable-line`, `eslint-disable-next-line`, an `oxlint-` equivalent or `eslint <config>`, unless the comment carries a tracked reference.
- A TypeScript directive without a tracked reference after it, in each form the compiler honours: `@ts-expect-error` or `@ts-ignore` opening a `//` or `///` comment, or opening the last line of a block comment after any `/` and `*`; and `@ts-nocheck` opening a `//` or `///` comment among the comments that start the file. Forms the compiler ignores, such as `/* @ts-nocheck */`, a directive above a block comment's closing line, or `////`, are not flagged. `@ts-check` turns checking on and is not flagged.
- A tracked reference is a parenthesised token with no spaces that contains a digit, such as `(#42)`, `(PROJ-7)`, `(spec-42)` or `(https://tracker.example/issues/42)`. `()`, `(legacy)` and `(issue 42)` are not tracked references.
- TODO is matched on raw lines, so the same text inside a string is flagged too; linter and type directives are read from comments only.
- Ordinary explanatory comments and JSDoc are not flagged; keeping them out is left to review.

## Settings
`trackerPatterns` narrows which tracked references count, for example to your own tracker's format. Each entry is a regular expression, as JavaScript source text, tested against each tracked reference with its parentheses; a reference counts when any entry matches. The test is an unanchored search unless the pattern anchors itself with `^` and `$`. The default, `["^\\(\\S+\\)$"]`, lets every tracked reference count.

```json
"clauseSettings": {
  "CD-5#comments-directives": { "trackerPatterns": ["^\\(spec-\\d+\\)$", "^\\(#\\d+\\)$"] }
}
```

The patterns only narrow: a reference must still be a parenthesised token with no spaces that contains a digit, so a pattern such as `.*` cannot make `(legacy)` count. The same measure applies to TODO, where the reference must come right after `TODO`. Each entry must be a non-empty string that compiles as a regular expression; otherwise the check stops with a piece-invalid failure naming the clause and the entry.

## Example violation
```ts
// biome-ignore lint/style/noNonNullAssertion: legacy
const first = items[0]!;
```

## How to fix
```ts
const first = items[0];
```
Remove the need for the directive. If it must stay, add the tracked reference: `// biome-ignore lint/style/noNonNullAssertion: legacy (#42)`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file legitimately carries untracked directives, such as generated code. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-5#comments-directives", "file": "src/generated/schema.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
