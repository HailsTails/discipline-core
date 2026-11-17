# CD-5: No comments, no JSDoc

## Rule

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Prose beside code drifts from the code, and nothing checks it. The friction makes a clear name the cheap fix, and makes every "the checker is wrong here" marker point at the work that removes it.

**What a finding points at.** Match the sites against these causes.
- *A name that says too little.* The comment explains what the name should. Rename, or extract a named function.
- *A rule the types do not hold.* The comment states an invariant. Move it into a type, a union or a schema, where it is checked.
- *A suppression standing in for a fix.* The directive silences another rule. That rule's finding is the real one; read its Spirit section.
- *A promise nobody holds.* An untracked TODO. Track it or do it.

**Where to go.** Names, types and schemas carry the meaning, with no prose beside them. Each directive that remains carries a tracked reference to the work that retires it, so the count of directives falls over time rather than settling.

**Reactions to distrust.**
- "This needs explaining." Then the code is not yet clear. The explanation is the brief for a better name.
- "Add a tracked reference and move on." A reference that excuses the escape instead of retiring it is the same hole with a label.
- "It's generated." Then that file is a boundary. Authorise it, and keep hand-written code clean.

**Principles behind it.**
- *Intention-revealing names* (Robert C. Martin, *Clean Code*). Clean Code treats a comment as compensating for code that failed to express its intent; the fix is in the code.
- *Make illegal states unrepresentable* (Yaron Minsky). An invariant stated in a type is checked on every change; the same invariant in a comment is checked by nobody.
