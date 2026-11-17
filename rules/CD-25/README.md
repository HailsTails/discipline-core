# CD-25: Unit tests fake everything outside the unit

## Rule

A unit test fakes everything outside the unit under test, injected through the unit's own seam — no real I/O, no real collaborators. The test exercises exactly one unit's logic, with every dependency a controlled fake, so a failure points at that unit and nowhere else.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A unit test should fail for one reason: this unit is wrong. The friction makes a plain fake with a fixed answer the easiest double to write, so a failure points at one place and the unit's seams stay narrow.

**What a finding points at.** Match the sites against these causes.
- *A seam wider than its use.* The fake needs logic because the port does many things or takes rich input. Narrow the port, and its inputs, to what this unit uses; the fake then answers one question.
- *Behaviour hiding in a collaborator.* The fake re-implements logic the unit relies on. That logic is a unit of its own with its own tests; the fake returns its result.
- *Real I/O in a unit test.* Files, on-disk fixtures, network, the clock. A dependency was reached for, not injected. Inject a port and fake it in memory.
- *An integration test with a unit suffix.* It wires several units over real backings. Move it to the integration layer, and keep that layer thin.

**Where to go.** Unit tests build every collaborator as an in-memory fake with fixed values. On-disk fixtures are integration test tools: used at a bare minimum, only where the composition under test demands a real backing.

**Reactions to distrust.**
- "It's just tests." The test is the unit's first consumer. A collaborator that is hard to fake is a design finding.
- "The fake must be realistic." Realism belongs in the few integration tests. A unit case needs one fixed answer.
- "A fixture file is easier." Easier once. Each one ties the test to real I/O and to data the reader cannot see in the test.

**Principles behind it.**
- *Test doubles* (Gerard Meszaros, *xUnit Test Patterns*). Doubles come in kinds; the one that returns a canned answer is the simplest, and it keeps the test about the unit rather than about the double.
- *Interface Segregation Principle* (Robert C. Martin, SOLID). A port shaped to one consumer's needs is trivial to fake; a fake that needs logic is reporting a port that serves too many needs.
- *The test pyramid* (Mike Cohn). Many fast isolated unit tests, few integration tests. Real backings and fixtures belong to the thin upper layer.
