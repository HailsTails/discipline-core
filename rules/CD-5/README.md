# CD-5: No comments, no JSDoc

## Rule

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.

The sections below describe what the audit check covers.

## Spirit

**What the friction is for.** Prose beside code drifts from the code, and nothing checks it. The friction makes a clear name the cheap fix, and makes every "the checker is wrong here" marker point at the work that removes it.

**What a finding points at.** Match the sites against these causes.
- *A name that says too little.* The comment explains what the name should. Rename, or extract a named function.
- *A rule the types do not hold.* The comment states an invariant. Move it into a type, a union or a schema, where it is checked.
- *A suppression standing in for a fix.* The directive silences another rule. That rule's finding is the real one; read its Spirit section.
- *A promise nobody holds.* An untracked TODO. Track it or do it.

**Where to go.** Names, types and schemas carry the meaning, with no prose beside them. Each directive that remains carries a tracker pointing at the work that retires it, so the count of directives falls over time rather than settling.

**Reactions to distrust.**
- "This needs explaining." Then the code is not yet clear. The explanation is the brief for a better name.
- "Add a tracker number and move on." A tracker that excuses the escape instead of retiring it is the same hole with a label.
- "It's generated." Then that file is a boundary. Authorise it, and keep hand-written code clean.

**Principles behind it.**
- *Intention-revealing names* (Robert C. Martin, *Clean Code*). Clean Code treats a comment as compensating for code that failed to express its intent; the fix is in the code.
- *Make illegal states unrepresentable* (Yaron Minsky). An invariant stated in a type is checked on every change; the same invariant in a comment is checked by nobody.

See [the spirit of the rules](../SPIRIT.md) for the measure, ask, decide chain.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-5#comments-directives` | audit | TODOs, linter directives and `@ts-expect-error` without a tracker |

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `// TODO` not followed by `(`. Any parenthesised text is accepted, for example `// TODO(spec-42) ...`.
- A comment starting with `biome-ignore`, `eslint-disable`, `eslint-enable`, `eslint-disable-line`, `eslint-disable-next-line`, an `oxlint-` equivalent or `eslint <config>`, unless the comment contains `(spec-<number>)`.
- `// @ts-expect-error` on a line without `(spec-<number>)`.
- TODO and `@ts-expect-error` are matched on raw lines, so the same text inside a string is flagged too.
- Ordinary explanatory comments and JSDoc are not flagged; keeping them out is left to review.

## Example violation
```ts
// biome-ignore lint/style/noNonNullAssertion: legacy
const first = items[0]!;
```

## How to fix
```ts
const first = items[0];
```
Remove the need for the directive. If it must stay, add the tracker: `// biome-ignore lint/style/noNonNullAssertion: legacy (spec-42)`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file legitimately carries untracked directives, such as generated code. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-5#comments-directives", "file": "src/generated/schema.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
