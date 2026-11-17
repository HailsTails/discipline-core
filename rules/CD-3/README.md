# CD-3: Strict mode flags inherited, never overridden

## Rule

Every unit compiles under one shared, maximally-strict compiler configuration; no unit weakens it locally. A relaxed flag in one corner (disabling strictness, unchecked indexing, exact-optional handling, catch-variable typing) creates a zone where the type system quietly stops protecting you, and that zone spreads. Strictness is inherited, never overridden.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Every relaxed compiler flag is a zone where the types quietly stop protecting you. The friction keeps one strict standard everywhere, so no corner of the codebase becomes the place errors hide.

**What a finding points at.** Match the configs against these causes.
- *Errors switched off instead of fixed.* A flag was relaxed because turning it on produced many errors. Those errors are the real finding; fix them by area.
- *A package that was never brought up to standard.* Legacy or imported code was given its own looser config. Raise it, starting with the flag that hides the most.
- *Types wrong at a boundary.* Indexed or optional access errors cluster around outside data. Parse that data into exact types at the boundary.

**Where to go.** Every unit inherits the one strict configuration and overrides nothing.

**Reactions to distrust.**
- "This flag is too strict for our code." It reports the cases your code does not handle. Handle them.
- "Just for this package." A relaxed corner spreads: code moves, and the looser rules move with it.

**Principles behind it.**
- *Broken windows* (Andrew Hunt and David Thomas, *The Pragmatic Programmer*). One tolerated lapse signals that lapses are acceptable, and more follow.
- *Fail fast.* A strict compiler reports the defect when it is written, not when it runs.
