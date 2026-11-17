# CD-21: Every injected port ships a default production factory

## Rule

A port is not just an interface — it ships its own default production implementation, co-located in the same module. Wiring is then trivial and there is exactly one canonical construction site per capability; production wires the default, tests supply their own fakes. A port with no default factory is an incomplete capability.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A port with no default implementation leaves every caller to work out how to build one. The friction makes the production wiring sit beside the port, so there is one obvious way to construct each capability.

**What a finding points at.** Match the ports against these causes.
- *Construction scattered.* Several places build the real implementation differently. Move it into a default factory beside the port.
- *A port invented only for tests.* It has fakes but no real implementation. Either give it a default or question whether it is a port.

**Where to go.** Each port's module exports its default production factory. Production wires the default; tests pass fakes.

**Reactions to distrust.**
- "The composition root builds it." It still calls one canonical factory, not its own construction.

**Principles behind it.**
- *Composition root.* All wiring happens in one place, from canonical factories.
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). Callers depend on the port; the default is one implementation of it.
