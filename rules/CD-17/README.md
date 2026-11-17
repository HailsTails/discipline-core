# CD-17: Clock is the only time source

## Rule

Time is an injected capability, not an ambient global: domain code never calls the runtime's now-primitives directly, it reads the current instant through a clock port. Real time enters through exactly one clock abstraction; tests inject a fake clock and advance it deterministically. Bare time construction anywhere else makes behaviour impossible to replace with a test double, and non-deterministic.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Code that reads the time itself behaves differently depending on when it runs. The friction makes time an input, so logic is deterministic and tests can set and advance time on demand.

**What a finding points at.** Match the sites against these causes.
- *Decisions that read the clock.* Business logic asks for the current time in the middle of a calculation. Pass the instant in, or inject the clock.
- *Time stamped in many places.* Many sites stamp records or events. One clock port at the edge; the instant travels inward as data.
- *Tests that wait or depend on wall time.* Flaky or slow tests point at a missing clock port. Inject a fake clock and advance it.
- *Tests that build their own instants.* A test making dates for itself is choosing time outside the clock. Take instants from the fake clock.

**Where to go.** One clock abstraction reads real time. Everything else receives an instant or the clock. Tests set the time they need.

**Reactions to distrust.**
- "It's just a log timestamp." It is still output nobody can pin in a test. Read it through the clock.
- "It's just tests." The rule covers tests. A test that reads real time cannot be repeated exactly.
- "Exclude that folder." Then that folder's behaviour depends on the hour it runs. Find the clock port it is missing.

**Principles behind it.**
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). Time is a detail; the logic depends on a clock abstraction it is given.
- *Functional core, imperative shell* (Gary Bernhardt). Reading the clock is an effect at the shell. The core receives the instant as a value and stays pure.
