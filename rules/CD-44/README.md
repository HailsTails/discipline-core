# CD-44: Functions must not mutate fields of parameters they receive

## Rule

A function never mutates the fields of the parameters it receives — no assigning to a parameter's property, no pushing into a parameter's array, no sorting it in place. It returns new data instead. Mutating an input makes the function's effect invisible at the call site and couples the caller to an order of operations it cannot see.

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A function that changes its inputs has an effect the call site cannot see. The friction makes returning new data the easy path, so every change is visible where it is used.

**What a finding points at.** Match the sites against these causes.
- *A function that both answers and changes.* It returns something and also edits what it was given. Return the new value; leave the input alone.
- *Ownership nobody decided.* Several functions edit one shared object in turn. Decide who builds the value, and pass results forward instead.
- *In-place sorting or pushing for convenience.* A library call mutates by default. Use the copying form, or copy first.
- *Accumulators passed in.* A collection is handed in to be filled. Return the items and let the caller combine them.

**Where to go.** Inputs are read-only. Functions return new values, and the caller decides what to keep.

**Reactions to distrust.**
- "Copying is slow." Usually unmeasured, and the rule makes no performance carve-out.
- "The caller wants the change." Then return it, and the caller can see it.

**Principles behind it.**
- *Functional core, imperative shell* (Gary Bernhardt). The core takes values and returns values; changes happen at the edge.
