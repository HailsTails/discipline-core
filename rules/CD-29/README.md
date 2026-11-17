# CD-29: Component/integration tests are the minimum, not the bulk

## Rule

Integration tests are the thin layer of the pyramid, not its bulk: many unit tests at the base, few component tests in the middle, a thin smoke layer on top. Inverting the pyramid — leaning on slow, broad integration tests to catch what unit tests should — is forbidden.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Broad tests are slow and say little about where a fault is. The friction keeps most tests small and fast, so the suite runs often and failures point at one unit.

**What a finding points at.** Match the suite against these causes.
- *Units that cannot be tested alone.* Integration tests carry the load because units take no injected dependencies. Inject them; unit tests follow.
- *Logic tested through the system.* Business rules are checked end to end. Move each rule's cases to the unit that owns it.

**Where to go.** Many unit tests, few component tests, a thin smoke layer.

**Reactions to distrust.**
- "Integration tests catch real bugs." They catch wiring bugs. Logic bugs belong to unit tests that run in milliseconds.

**Principles behind it.**
- *The test pyramid* (Mike Cohn). Many fast unit tests at the base, fewer broader tests above.
