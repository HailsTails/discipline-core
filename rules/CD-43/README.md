# CD-43: Booleans are evaluative, not declarative

## Rule

A boolean parameter, field, or return is an evaluative predicate the reader must decode at every call site — `true` for what? Prefer a string-literal or discriminated union that states the meaning in the value itself. Booleans that name a state or mode hide that meaning behind a bare truth value.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A bare true or false says nothing about what it means. The friction makes naming the state the easy path, so a call site reads as what it does.

**What a finding points at.** Match the sites against these causes.
- *A mode passed as a flag.* A parameter switches the function between behaviours. Split the function, or name the modes as a union.
- *A state that will grow.* Today it is on or off; tomorrow there is a third case and a second flag. Name the states now.
- *Two flags that cannot both be true.* Pairs of booleans allow combinations that make no sense. One union rules them out.
- *An outcome as a boolean.* A result says success or not, and the reason is lost. Return a tagged outcome.

**Where to go.** States and modes are named values. A reader learns the meaning from the value itself.

**Reactions to distrust.**
- "It's obviously a yes or no." Then name what yes means. If that is easy, the union is easy.
- "The library returns a boolean." Read it at the boundary and turn it into your own named state there.

**Principles behind it.**
- *Make illegal states unrepresentable* (Yaron Minsky). A union of named states rules out the combinations flags allow.
- *Flag arguments* (Robert C. Martin, *Clean Code*). A boolean argument announces that the function does more than one thing.
