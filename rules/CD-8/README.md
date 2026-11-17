# CD-8: No default on switch over a closed discriminated union

## Rule

A switch over a closed discriminated union carries no `default:` arm. Exhaustiveness is the type system's job: with no default, adding a variant surfaces as a compile error at every switch that has not handled it. A `default:` swallows that signal and lets the new variant slip through silently at runtime.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** When a new case is added, every place that must handle it should fail to compile until it does. A catch-all arm switches that off. The friction keeps the compiler finding those places for you.

**What a finding points at.** Match the sites against these causes.
- *A catch-all kept "for safety".* The union is closed, so the arm can only hide future cases. Remove it and let the compiler check exhaustiveness.
- *Input that was never parsed.* The value might be anything because it came from outside unchecked. Parse it at the boundary into the closed union; then the switch is closed.
- *Several cases sharing one arm.* Default is used as "everything else does the same". List those cases by name.

**Where to go.** Every switch over a closed union names every case. Adding a case lights up every place that must decide what to do with it.

**Reactions to distrust.**
- "What if a value we don't know arrives?" Then the value was not parsed. That is a boundary problem, not a switch problem.
- "Listing every case is verbose." The list is what the compiler checks.

**Principles behind it.**
- *Exhaustiveness checking.* The compiler proves every case is handled; a catch-all arm withdraws the proof.
- *Make illegal states unrepresentable* (Yaron Minsky). Once the input is a closed union, an unknown case cannot exist to be defaulted.
