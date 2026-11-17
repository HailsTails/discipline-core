# CD-31: No coverage thresholds

## Rule

Coverage is a diagnostic to read, not a gate to pass. A percentage threshold rewards tests written to move a number; the real floor is the every-file test sibling. Chasing a coverage figure produces assertion-free tests that raise the metric and protect nothing.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A coverage target rewards running code, not checking it. Without the target, nothing rewards a test that moves the number and checks nothing. The floor comes from every unit having its own test, and coverage stays something to read.

**What a finding points at.** Match the configuration against these causes.
- *A number standing in for a floor.* The threshold exists because nothing guaranteed every unit a test. The every-file sibling rule is that floor.
- *Tests written to move the number.* Tests with no real assertions appear. Remove them; read coverage as a diagnostic.

**Where to go.** Coverage is read to find untested behaviour, never gated.

**Reactions to distrust.**
- "Without a target, coverage will drop." The sibling rule holds the floor; the number is for reading.

**Principles behind it.**
- *Goodhart's law*, in Marilyn Strathern's phrasing: "When a measure becomes a target, it ceases to be a good measure."
