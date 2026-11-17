# CD-10: Throws permitted in exactly two contexts

## Rule

Throwing is confined to a closed, named set of contexts: a startup-invariant check that fails at boot, and a branch made unreachable by exhaustive type narrowing. Defensive throws — "this should never happen", "guard against impossible state" — are forbidden: if you can name the state, you can model it as a result variant. A library that throws is caught at the boundary and converted to a result. Tests carry no exemption; they surface failures through assertions, not by throwing.

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A throw is a failure the type does not mention. The friction makes returning the failure as a value the easy path, so every caller sees what can go wrong and must decide what to do.

**What a finding points at.** Match the sites against these causes.
- *A defensive "can't happen".* A throw guards a state the code believes impossible. If you can name the state, model it as a result variant or rule it out with a type.
- *A library that throws, caught too late.* Exceptions escape into the core. Catch at the wrapping boundary and return a result.
- *Tests that throw to fail.* A test throws instead of asserting. Assert on the result; the assertion is the failure.
- *Failure modes nobody listed.* Errors are thrown because no error type exists yet. List the ways the operation fails.

**Where to go.** Throws exist only for a failed startup invariant and a branch the types prove unreachable. Everything else returns its failure.

**Reactions to distrust.**
- "It really can't happen." Then the type can say so, and the throw is unnecessary.
- "Results are verbose." They are the failure paths written down. A throw hides the same paths.

**Principles behind it.**
- *Railway oriented programming* (Scott Wlaschin). Success and failure travel as two tracks of one value, so failure is handled, not escaped.
- *Fail fast.* A broken startup invariant stops the program at once; that is the one place a throw is the clearest signal.
