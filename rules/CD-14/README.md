# CD-14: Zero class authoring; classes only at external-library call sites

## Rule

Behaviour is composed from functions and closures, not authored classes — state lives in a factory that closes over it. A class appears only where an external library's API demands `new` at the call site; that instance is created inside the wrapping factory and held internally, never re-exported as a class. The rule is per-declaration, not per-export: even a non-exported authored class is a violation.

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A class bundles state, behaviour and identity, and invites inheritance as a way to share code. The friction makes a factory closing over its state the easy shape, so state is private by construction and behaviour is plain functions.

**What a finding points at.** Match the sites against these causes.
- *State that changes between calls.* The class holds counters, caches or buffers. Replace it with a factory that keeps them in private bindings and returns functions.
- *A namespace with a constructor.* The methods only read configuration, or the members are all static. Make them plain functions that take that configuration as an argument.
- *Inheritance used for reuse.* A base class shares behaviour. Compose functions instead.
- *A library class spreading.* A library's class is built in many places or handed out. Build it once inside its wrapping factory and expose functions.

**Where to go.** No authored classes. A library class is built only in its wrapping factory and never leaves it as a class.

**Reactions to distrust.**
- "Classes are just syntax." The concern is state hidden behind a shared reference and reuse by inheritance, not the keyword.
- "The library needs `new`." The rule allows that, inside the wrapping factory.
- "Errors need classes." Operational failures are plain data returned as results (CD-9, CD-11).

**Principles behind it.**
- *Favour composition over inheritance* (Gamma, Helm, Johnson and Vlissides, *Design Patterns*). Behaviour assembled from parts changes more safely than behaviour inherited from a base.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). A library's class belongs inside its adapter, behind your own functions.
