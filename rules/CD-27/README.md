# CD-27: Tests are zero-everything — zero logic, zero branches, zero unpredictability

## Rule

Test bodies are zero-logic straight lines: no branching, no loops, no try, no ternary, no computed expectations — just arrange, act, assert against hardcoded values. Logic in a test is untested code testing code; variability is supplied by a stub and pinned, never accommodated with a conditional.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A test is the unit's specification, and it is read when it fails. Logic in a test is code with no test of its own. The friction makes a straight line with written-out expectations the easy test, so a failure can be trusted and read in one pass.

**What a finding points at.** Match the sites against these causes.
- *Output that is hard to predict.* Expectations are computed because the result varies with time, randomness or ordering. Inject the source of variation and pin it with a stub.
- *Several cases in one test.* A branch or a conditional picks between cases. Write one test per case, or one parameterised test over a table of rows.
- *The unit's logic repeated in the test.* The test derives the answer the way the unit does. Write the answer out. If that is hard, the unit returns too much for one case or does too much.
- *Failures caught to inspect them.* A try in a test means the unit throws where it could return its failure as data. Assert on the returned result.
- *Tests switched off or focused.* A skip or an only hides a failing, slow or flaky case. Fix it or delete it.

**Where to go.** Every test is arrange, act, assert, against literal values. Variation comes from injected stubs. N cases are N tests or one table.

**Reactions to distrust.**
- "It's just a helper in the test." A helper with logic is untested code deciding whether other code passes.
- "Written-out values are brittle." They break when behaviour changes. That is their job.
- "The expected value is too big to write." Then the test asserts more than the unit's own responsibility, or the unit does too much.

**Principles behind it.**
- *Conditional Test Logic* (a test smell in Gerard Meszaros, *xUnit Test Patterns*). A test with branches can pass without checking what it claims to check.
- *Arrange, act, assert.* One setup, one action, one check: the shape that makes a test a readable specification.
