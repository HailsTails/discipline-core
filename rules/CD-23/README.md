# CD-23: Every unit has a co-located test sibling

## Rule

Every source file ships a test sibling that sits beside it, sharing its name — there are no source files without a test, and no tests in a separate parallel tree. This is the real coverage floor: not a percentage, but the guarantee that every unit has at least one co-located test stating what it is for. Co-location makes the test the unit's visible contract and keeps the two changing together, where a parallel test tree lets them drift apart.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A unit nobody can test alone is a unit nobody understands alone. The friction makes "write the test beside it" part of writing the unit, so every unit has a stated purpose and the two change together.

**What a finding points at.** Match the files against these causes.
- *A unit too tangled to test.* The test was skipped because the unit reaches its dependencies directly. Inject them; the test then writes itself.
- *A file that is not a unit.* It holds loose pieces with no single purpose. Split it into units that each have one.
- *Tests in a parallel tree.* The tests exist but live elsewhere and drift. Move each beside its unit.
- *Tested only through something bigger.* The unit is covered only by an integration test. Give it its own.

**Where to go.** Every unit has a sibling test that states what it is for, and the two are edited together.

**Reactions to distrust.**
- "It's covered by the integration tests." Covered is not specified. A failure there does not say which unit broke.
- "It's too simple to test." Then the test is short. It still states the purpose.

**Principles behind it.**
- *Listen to the tests* (Steve Freeman and Nat Pryce, *Growing Object-Oriented Software, Guided by Tests*). Difficulty testing a unit is feedback about its design.
- *Common Closure Principle* (Robert C. Martin). Things that change together belong together; a unit and its test change together.
