# CD-19: External dependencies confined to wrapping ports at the boundary

## Rule

Every dependency on code the project does not own — a third-party library or the runtime's own standard library alike — is confined to a single wrapping port at the boundary; the rest of the codebase depends on that port, never the vendor or platform surface, runtime or type-only. A dependency swap then touches one file, the vendor's types never leak inward, and each confined capability is nameable and fakeable in tests. There is no inline carve-out: a stdlib call in the middle of business logic is as much a violation as a scattered library import. Opening a new wrapping site for a new dependency is a deliberate, recorded decision.

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Depending on code you do not own hands that code a say in the shape of yours. The friction makes depending on your own port the easy path, so a swap touches one file, vendor types stay out, and every capability has a name and a fake.

**What a finding points at.** Match the sites against these causes.
- *A capability with no name.* Many files import the same library or runtime module. Name the capability, wrap it once, inject it.
- *A port that leaks.* A wrapper exists but passes vendor types or objects through, so callers import the vendor anyway. Make the port speak your types.
- *Decisions doing I/O.* A runtime call sits in the middle of business logic. Separate the decision from the effect; the effect arrives through a port.
- *Construction spread everywhere.* Each module builds its own dependencies. Move construction to one composition root that passes ports in.

**Where to go.** Each external capability has one wrapping file, recorded as its authorised location. Everything else imports your port. Opening a new wrapper is a recorded decision, not an inline one.

**Reactions to distrust.**
- "It's only the standard library." The same reasons apply: it cannot be faked and it ties logic to a platform. The rule makes no stdlib carve-out.
- "Wrapping is boilerplate." One small file per capability, against the whole codebase knowing a vendor's surface.
- "Exclude that folder." An excluded folder is a boundary nobody designed. Design it, then authorise the one file.

**Principles behind it.**
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). Your code depends on an abstraction you own; the vendor detail depends on it, not the other way round.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). The application talks through ports; one adapter per outside system translates. Swapping the system means swapping the adapter.
- *Functional core, imperative shell* (Gary Bernhardt). Decisions stay pure; effects live at the edge and arrive through ports.
