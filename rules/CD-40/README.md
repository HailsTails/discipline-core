# CD-40: Single-object-argument functions

## Rule

A function takes a single named-field object argument rather than a positional parameter list, so every call site reads as a labelled contract instead of a sequence of unlabelled values whose meaning depends on order. Named fields also make adding or reordering parameters a safe, non-breaking change.

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Positional arguments make meaning depend on order, and nothing checks the order. The friction makes a labelled call the easy one, and turns what each function needs into a named shape a reader can see.

**What a finding points at.** Match the sites against these causes.
- *Values that travel together without a name.* The same group of arguments passes through several functions. Name the group as one type.
- *A function with several jobs.* It has many parameters because it serves many concerns. Split it.
- *Flags steering behaviour.* An argument switches between modes. Split the function, or make the mode a named union.
- *Asking for more than it uses.* Converting to one object invites passing a whole record. Take only the fields the function reads; tests then build only those.

**Where to go.** Every function takes one object whose fields are named and minimal. Adding a field breaks no caller.

**Reactions to distrust.**
- "Two parameters is fine; the check allows it." The check stops at two. The rule asks for one named object.
- "The library dictates this callback." Then the callback is the boundary. Hand off to a single-object function on its first line.
- "An object is more typing." It is a few characters at the call site, against every reader guessing the order.

**Principles behind it.**
- *Function arguments* (Robert C. Martin, *Clean Code*). Each extra argument is something the reader must hold in mind and the caller can get wrong.
- *Introduce Parameter Object* (Martin Fowler, *Refactoring*). The refactoring that names a group of values that travel together.
- *Interface Segregation Principle* (Robert C. Martin, SOLID). The object asks for exactly the fields used, no more.
