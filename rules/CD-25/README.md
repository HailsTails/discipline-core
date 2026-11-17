# CD-25: Unit tests replace everything outside the unit with test doubles

## Rule

A unit test replaces everything outside the unit under test with a test double, injected through the unit's own seam — no real I/O, no real collaborators. The test exercises exactly one unit's logic, with every dependency a controlled double, so a failure points at that unit and nowhere else.

**Test doubles.** These rules use Gerard Meszaros's names from *xUnit Test Patterns*, and only in these senses. A *dummy* is passed but never used. A *stub* returns canned answers. A *spy* is a stub that also records how it was called, for the test to assert afterwards. A *mock* is set up with expectations and verifies them itself. A *fake* is a working, lightweight implementation, such as an in-memory repository. The doubles a unit test builds itself are dummies, stubs and spies. A double that needs behaviour is a fake: it is written once as an in-memory implementation of the port, with its own tests, and passed in like any other double (a fake clock that the test advances is one), not built inline in a test.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A unit test should fail for one reason: this unit is wrong. The friction makes a stub with a canned answer the easiest double to write, so a failure points at one place and the unit's seams stay narrow.

**What a finding points at.** Match the sites against these causes.
- *A seam wider than its use.* The double needs logic because the port does many things or takes rich input. Narrow the port, and its inputs, to what this unit uses; a stub then answers its one question.
- *Behaviour hiding in a collaborator.* The double re-implements logic the unit relies on. That logic is a unit of its own with its own tests; a stub returns its result.
- *Real I/O in a unit test.* Files, on-disk fixtures, network, the clock. A dependency was reached for, not injected. Inject a port and give the test a stub, or the port's shared in-memory fake.
- *An integration test with a unit suffix.* It wires several units over real backings. Move it to the integration layer, and keep that layer thin.

**Where to go.** Unit tests give every collaborator a stub or spy with canned answers, or the port's shared in-memory fake. On-disk fixtures are integration test tools: used at a bare minimum, only where the composition under test demands a real backing.

**Reactions to distrust.**
- "It's just tests." The test is the unit's first consumer. A collaborator that is hard to replace with a double is a design finding.
- "The double must be realistic." Realism belongs in the few integration tests. A unit case needs one fixed answer.
- "A fixture file is easier." Easier once. Each one ties the test to real I/O and to data the reader cannot see in the test.

**Principles behind it.**
- *Test doubles* (Gerard Meszaros, *xUnit Test Patterns*). Doubles come in kinds; the stub, which returns a canned answer, is the simplest, and it keeps the test about the unit rather than about the double.
- *Interface Segregation Principle* (Robert C. Martin, SOLID). A port shaped to one consumer's needs is trivial to stub; a stub that needs logic is reporting a port that serves too many needs.
- *The test pyramid* (Mike Cohn). Many fast isolated unit tests, few integration tests. Real backings and fixtures belong to the thin upper layer.
