# CD-12: Repositories are the primary storage abstraction

## Rule

Storage sits behind a repository port. Domain code talks to the port; an adapter composes the raw storage-driver primitives behind it. The domain never imports the storage driver or a filesystem primitive directly — so the storage technology can change without the domain knowing.

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Storage technology changes more often than the domain. The friction keeps the domain talking to a repository port, so storage can change without the domain knowing.

**What a finding points at.** Match the sites against these causes.
- *Queries written in domain code.* Domain functions call the driver directly. Move the query behind a repository method named for what the domain needs.
- *A repository that leaks its driver.* The port returns driver rows or types. Return domain shapes.
- *Files used as storage directly.* Filesystem calls sit in domain logic. Put them behind a repository too.

**Where to go.** The domain depends on repository ports. Adapters compose the driver behind them.

**Reactions to distrust.**
- "We'll never change the database." The port is also what lets tests stub storage.

**Principles behind it.**
- *Repository* (Martin Fowler, *Patterns of Enterprise Application Architecture*). A collection-like interface between the domain and data mapping.
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). The domain defines what it needs; storage implements it.
