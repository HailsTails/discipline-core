# CD-26: No module-mocking — module-mock means DI is wrong

## Rule

Faking happens through the unit's own injected dependencies, never by intercepting the module system. A module-mock is a signal that the dependency injection is wrong: if a unit reaches for a collaborator the test cannot substitute through the signature, the collaborator should have been a port. Fix the seam, don't mock the module.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** If a test can only control a dependency by intercepting imports, production cannot swap it either. The friction makes passing the collaborator in the easy route, so the unit is the same code under test and in production.

**What a finding points at.** Match the sites against these causes.
- *A collaborator imported, not received.* The unit reaches its dependency through an import. Make it a port the unit receives in its argument.
- *No place that wires.* Nothing builds the real dependencies and passes them in, so imports are the only wiring there is. Create one composition root.
- *A port too big to fake.* Mocking the whole module is easier than faking a wide port. Narrow the port to what this unit uses.
- *Ambient capabilities.* Time, randomness, environment or the filesystem read directly. Same cause; see CD-17 and CD-19.

**Where to go.** Every collaborator arrives through the unit's own signature. Tests hand in fakes exactly the way production hands in the real thing. Start with the module mocked most often; one port at a time.

**Reactions to distrust.**
- "It's just tests." The module-mock is the test reporting the design. The fix is in the unit.
- "The framework's docs mock modules." A framework idiom does not make the seam right. Wrap the framework behind a port.
- "Rewiring is too big." It is one port at a time, and each one removes a mock for good.

**Principles behind it.**
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). The unit depends on an abstraction it is given, not on a concrete module it imports.
- *Dependency injection and the composition root.* Dependencies are built in one place and passed in, so any of them can be replaced without touching the unit.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). A test is one more adapter plugged into the same port.
