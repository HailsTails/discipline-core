# CD-15: Iteration is functional transformation, never an imperative loop

## Rule

Iteration is a transformation, expressed with `map`, `reduce`, `flatMap`, `filter`, or `Array.from` — so it reads as data flowing through a pipeline rather than as mutable imperative stepping. Pure side-effect iteration (logging, registering listeners) uses `forEach` with a callback that returns void. The two imperative shapes this rule replaces are element iteration (`for…of`) and counted iteration (`for (let i = 0; …; i++)`): the first becomes a functional traversal, and the second becomes `Array.from({ length }, mapper)` where the index is derived from position rather than incremented by a manual counter that can drift out of bounds.

**Async stream consumption is iteration this rule does not reach.** Draining an `AsyncIterable` — pulling `await iterator.next()` until exhaustion, or the `for await…of` that desugars to it — is permitted at sites declared as authorised locations for CD-15. The functional forms cannot express it: `map`/`reduce`/`flatMap` over an `AsyncIterable` require materialising the whole stream, which destroys the bounded-residency property that streaming exists to provide. This is a structural fact about the language, not debt — a drain loop at a declared site is fully compliant, carries no paydown obligation, and takes an authorised-location entry, never a carve-out. Everything the rule does reach still binds inside such a loop: the body is a transformation, accumulator updates are whole-value replacements rather than in-place mutation, and synchronous iteration over materialised collections stays functional.

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A loop says how to step; a transformation says what is produced. The friction makes naming the transformation the easy path, and removes counters that drift and accumulators changed in place.

**What a finding points at.** Match the sites against these causes.
- *A transformation hidden in control flow.* The body builds one result from each element. Express it as a map, filter or reduce.
- *Several jobs in one pass.* One loop filters, reshapes and records. Split it into named steps.
- *Effects mixed with computation.* The loop computes and writes at once. Compute the result first, then perform the effects at the edge.
- *A stream being drained.* Consuming an async stream is a limit of the language, not debt. Record the site as an authorised location; it is fully compliant.

**Where to go.** Iteration reads as data flowing through named transformations, with effects at the end.

**Reactions to distrust.**
- "Loops are faster." Usually unmeasured, and the rule makes no performance carve-out. Measure before arguing it.
- "It's just tests." A loop in a test is several cases in one. Use one parameterised test over the rows (CD-27).
- "A loop is clearer here." Clearer to the writer, who knows what it builds. Name what it builds.

**Principles behind it.**
- *Replace Loop with Pipeline* (Martin Fowler, *Refactoring*, second edition). A collection pipeline names each step of the processing.
- *Functional core, imperative shell* (Gary Bernhardt). The transformation is pure; effects run at the edge on its result.
