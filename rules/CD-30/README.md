# CD-30: Integration tests catch composition bugs only

## Rule

An integration test exists to catch composition bugs — wiring, contracts between units — not unit-level logic bugs. If an integration test is the first thing to fail on a logic error, the missing test is a unit test; add it at the base rather than diagnosing through the composed system.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** An integration test that finds a logic bug is doing a unit test's job slowly and vaguely. The friction keeps integration tests on wiring, so each layer catches what it is best at.

**What a finding points at.** Match the tests against these causes.
- *A missing unit test.* A logic bug surfaced first in integration. Add the unit test at the base.
- *Integration tests asserting logic.* The test checks calculations, not connections. Move those cases down.

**Where to go.** Integration tests check that units connect correctly. Unit tests check what each unit computes.

**Reactions to distrust.**
- "It's more realistic." Realism costs speed and precision. Spend it on wiring only.

**Principles behind it.**
- *The test pyramid* (Mike Cohn). Each layer has a job; broad tests are few because they localise faults poorly.
- *Defect localisation.* A failing test should point at the fault. A logic failure in an integration test points at the whole system.
