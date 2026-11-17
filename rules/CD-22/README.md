# CD-22: Middleware generic context constraint

## Rule

Middleware carries the context it consumes through a constrained generic that each layer widens, not an open property bag — so a capability the middleware reads from context (time, logging, correlation) is guaranteed present by the type rather than defensively re-checked or defaulted. A middleware that reads a context field but leaves its context generic unbounded is the violation.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Middleware that reads from an open property bag has to check whether what it needs is there. The friction makes the type guarantee it, so capabilities are present by construction.

**What a finding points at.** Match the sites against these causes.
- *Context read defensively.* Middleware checks or defaults a field like the clock or logger. Constrain its context type so the field must exist.
- *Layers that add capabilities untyped.* Earlier layers add fields the type never records. Widen the generic at each layer.

**Where to go.** Each middleware declares the context it needs through a constrained generic. A missing capability is a compile error.

**Reactions to distrust.**
- "A default is safer." A default hides wiring mistakes until they matter.

**Principles behind it.**
- *Make illegal states unrepresentable* (Yaron Minsky). A context type that requires the field cannot be built without it.
- *Explicit dependencies.* A unit states what it needs in its signature, not by reaching into a shared bag.
