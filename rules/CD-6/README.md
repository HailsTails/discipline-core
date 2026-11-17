# CD-6: Meaningful names always — no shorthand, no filler words

## Rule

A name states the concept the value represents, not its shape or its category. Shorthand (single letters, truncations) and filler words (data, info, value, result, manager, handler) force the reader to reconstruct meaning the name should have carried — at every scope, including callback parameters and destructures. The name is the documentation.

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A reader meets a name far more often than its definition. The friction makes stating the concept the easy path, so meaning lives where it is read.

**What a finding points at.** Match the sites against these causes.
- *A concept not yet understood.* `data` or `result` because the writer did not know what the value was. Find out, then name it.
- *A function returning a mix.* `result` is the only honest name because the function returns several things. Split it.
- *No shared vocabulary.* The team has no agreed words for the domain, so names fall back to shapes. Agree the terms and use them in code.
- *A framework's habit copied inward.* `req`, `res`, `e` from library examples. Name it for what it is in your code.

**Where to go.** Every name states the concept, in the domain's words, at every scope.

**Reactions to distrust.**
- "Everyone knows what `i` means." They know it is an index, not an index of what.
- "Short scopes don't need long names." The rule covers every scope. The reader of a short scope still has to reconstruct the meaning.
- "It's the library's convention." Conventions belong at the boundary. Inside, use your words.

**Principles behind it.**
- *Intention-revealing names* (Robert C. Martin, *Clean Code*). A name should say why the thing exists and what it does, so no comment is needed.
- *Ubiquitous language* (Eric Evans, *Domain-Driven Design*). The code uses the same words as the people who know the domain.
