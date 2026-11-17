# CD-28: Tests assert only what the unit is directly responsible for

## Rule

A test asserts the unit's own direct responsibility — its returned output and the calls it makes to its collaborators — not the transitive internals of those collaborators. Asserting through a dependency couples the test to code the unit does not own and makes it fail for the wrong reasons.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A test that checks what a collaborator does breaks when that collaborator changes, even if this unit did not. The friction keeps each test on its own unit, so a failure means this unit broke.

**What a finding points at.** Match the tests against these causes.
- *Assertions reaching through stubs.* The test checks what a stub returned, not what the unit did with it. Assert the unit's output and the calls it made.
- *A real collaborator in the test.* The test asserts results produced by code it does not own. Replace it with a stub.
- *A unit that passes values through.* The only thing to check is a delegate's output. The unit may have no responsibility of its own; question it.

**Where to go.** Each test asserts the unit's own output and the exact calls it makes. Collaborators have their own tests.

**Reactions to distrust.**
- "Testing through gives more confidence." It gives confidence about the collaborator, and blame in the wrong place when it fails.

**Principles behind it.**
- *Law of Demeter.* A unit talks to its immediate collaborators; a test of it should too.
- *Fragile Test* (a test smell in Gerard Meszaros, *xUnit Test Patterns*). Tests that depend on more than the unit break for reasons unrelated to it.
