# CD-13: Kernel layer boundaries are non-negotiable

## Rule

Dependencies point inward and only inward: the domain depends on nothing, the application layer orchestrates the domain, adapters implement the ports the inner layers declare, and transports are leaves at the edge. An inner layer importing an outer one is the violation — it is what inverts the dependency direction the architecture exists to protect.

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** When inner code depends on outer code, a change at the edge breaks the core. The friction keeps dependencies pointing inward, so the core can be understood, tested and kept without its delivery details.

**What a finding points at.** Match the imports against these causes.
- *The domain reaching for infrastructure.* Domain code imports an adapter or transport. Declare a port in the inner layer and implement it outside.
- *Layers not named.* Code is not sorted into layers, so direction cannot be seen. Name the layers and place each module.
- *Shared types living outside.* Inner code imports outer code only for a type. Move the type inward.

**Where to go.** The domain depends on nothing. The application orchestrates the domain. Adapters implement inner ports. Transports sit at the edge.

**Reactions to distrust.**
- "It's just one import." It is the direction that matters; one import is how it reverses.

**Principles behind it.**
- *The Dependency Rule* (Robert C. Martin, *Clean Architecture*). Source dependencies point only inward.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). The core declares ports; the outside implements them.
