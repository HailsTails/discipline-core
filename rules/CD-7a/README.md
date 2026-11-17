# CD-7a: No ReturnType<typeof X> for our own codebase

## Rule

Every type the code produces is named and exported, and callers use that named type. Deriving a type from a factory's inferred return couples the type to the implementation, hides it from find-usages, and breaks the moment the factory's internals shift. The single carve-out is an external library symbol whose package exports no named return type.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A type derived from what a function happens to return changes whenever the implementation does. The friction makes naming the type the easy path, so the contract is declared, findable, and stable.

**What a finding points at.** Match the sites against these causes.
- *A contract nobody wrote down.* The factory's output was never named, so callers derive it. Name and export the type, and let the factory declare it returns that.
- *Implementation details leaking out.* The derived type exposes everything the factory builds. Declare only what callers should rely on.
- *A library with a named type you missed.* The package exports the type already. Use it.

**Where to go.** Every type the code produces has a name, and callers use the name.

**Reactions to distrust.**
- "Deriving keeps it in sync." It keeps it in sync with whatever the implementation does, including mistakes.
- "Naming it is duplication." The name is the contract; the implementation is one way to meet it.

**Principles behind it.**
- *Program to an interface, not an implementation* (Gamma, Helm, Johnson and Vlissides, *Design Patterns*). Callers depend on a declared contract, not on the shape the implementation produces.
- *Intention-revealing names* (Robert C. Martin, *Clean Code*). A named type says what the value is for.
