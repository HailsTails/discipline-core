# CD-1: No any, ever

## Rule

`any` is the absence of a type: it tells the compiler to stop checking, and that hole propagates silently through every call site that consumes the value. The whole reason a type system exists — catching shape errors before runtime — is forfeited at each `any`. Give the value a concrete type where it enters, checked at runtime, or a precise union. Every `any` is a violation regardless of stated reason: no code form or setting permits one. Debt a repository carries while adopting the rule is held only in exception records.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A value with no type switches off checking for everything it touches. The friction makes "this value has a known shape" the cheapest thing to write, so the compiler keeps doing the work at every use instead of a reader doing it in their head.

**What a finding points at.** Match the sites against these causes.
- *Input never typed where it entered.* A request, file, parse or database row crossed in and nobody said what it is. Give it a concrete type at that boundary, checked at runtime.
- *A shape nobody named.* The value has a shape that was never declared. Declare it as a type or a union.
- *A library kept at arm's length.* The vendor's types were awkward, so they were dropped. Wrap the library once and hand the rest of the code your own type.
- *One function serving many shapes.* It takes anything because its callers differ. Split it, or make the variants an explicit union.

**Where to go.** Every value inside the codebase has a known type. Unknown data becomes concrete where it arrives, not somewhere further in. A high count is usually one or two boundaries that were never built; build those first and most sites go with them.

**Reactions to distrust.**
- "It's just tests." A test that needs an untyped value builds its input the wrong way. Build the real type.
- "The library forces it." It forces it at one call. One wrapping file holds that.
- "Swap it for unknown." Unknown carried inward is the same debt, deferred. Very few values should stay unknown past the boundary.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). Turn untyped input into a typed value once, where it arrives, so everything after it can rely on the type.
- *Make illegal states unrepresentable* (Yaron Minsky). A precise type or union rules out shapes the code cannot handle; an untyped value rules out nothing.
