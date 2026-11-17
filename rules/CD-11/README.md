# CD-11: Operational error envelopes are plain data, not classes

## Rule

Operational error envelopes are plain, tagged data — constructed by a factory, inspected by a type guard, dispatched by an exhaustive switch on the tag — never authored classes extending the runtime's error type. Data-shaped errors compose, narrow, and serialise; class hierarchies for operational failure do not. The only authored error class is the single startup-invariant one the throw rule permits.

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Errors are values the code passes, narrows and serialises. The friction makes plain tagged data the easy shape, so errors compose like any other data.

**What a finding points at.** Match the sites against these causes.
- *Error hierarchies built by inheritance.* Error kinds are subclasses. Make them variants of one tagged union.
- *Errors carrying behaviour.* Error objects have methods. Move the behaviour into functions that take the error.
- *Errors that cannot cross a boundary.* Class instances lose their type when serialised. Plain data survives.

**Where to go.** Each error is plain data with a tag, built by a factory and dispatched by an exhaustive switch.

**Reactions to distrust.**
- "Stack traces need the error class." Operational failures are expected outcomes, not bugs; they need context, not a trace.

**Principles behind it.**
- *Favour composition over inheritance* (Gamma, Helm, Johnson and Vlissides, *Design Patterns*). Variants of a union compose; a class hierarchy fixes one axis of variation.
- *Algebraic data types.* A tagged union of error variants is checked for exhaustiveness wherever it is handled.
