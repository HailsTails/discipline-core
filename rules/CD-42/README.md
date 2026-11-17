# CD-42: Unhappy paths are early returns; happy path is the final return

## Rule

Unhappy paths are handled first as guard clauses that return early; the happy path is the final, un-nested return at the bottom. There is no `else` after an early return. Guarding first keeps the main path flat and readable, instead of burying it inside nested conditionals.

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Nested conditions bury the main path. The friction makes "handle the failures first, then do the work" the easy shape, so the main path reads flat at the bottom.

**What a finding points at.** Match the sites against these causes.
- *Failures handled after success.* The happy path sits inside an if and the failure in the else. Invert it: return early on failure.
- *Several checks nested inside each other.* Each guard adds a level. Make each a separate early return.
- *A function with two jobs.* Both branches do real work. Split it into two functions.

**Where to go.** Guards at the top, each returning early. The final return is the happy path, with no else.

**Reactions to distrust.**
- "Single exit is cleaner." It forces nesting and a variable to carry the answer. Early returns keep each case in one place.
- "The else makes it explicit." After a return, the else adds only indentation.

**Principles behind it.**
- *Replace Nested Conditional with Guard Clauses* (Martin Fowler, *Refactoring*). Unusual cases leave early; the normal case reads straight down.
