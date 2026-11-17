# CD-47: Tests are hermetic — no real side effects on anything real

## Rule

A test may not touch its environment or cause any real side effect on anything real. "Anything real" is everything the test did not itself create and does not itself dispose: the developer's repository, their user configuration and home directory, any network or live service, shared filesystem paths, the system clock, and the ambient process environment.

A test fakes the real subsystem. Spawning it is permitted in exactly one closed case: the subsystem's own observable behaviour is the assertion's subject and no fake can stand in for it. Setup, realism and convenience never qualify; state which assertion cannot be written against a fake, and if that sentence cannot be written, the test does not qualify. A qualifying test brings its own instance in a location it created and removes it afterwards; it never borrows the machine's.

Real git is the mechanically checked class: a test that spawns a real `git` subprocess passes an explicit hermetic environment at that call site, and never inherits the ambient one.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A test that touches real things can damage them, and can pass or fail depending on the machine. The friction makes faking the subsystem the easy path, so tests are safe to run anywhere and give the same answer every time.

**What a finding points at.** Match the sites against these causes.
- *A subsystem reached directly.* The code under test calls the real process, network, or filesystem. Inject a port and fake it.
- *Environment inherited by accident.* A spawned process picks up the developer's settings. Pass an explicit, created environment, or fake the process.
- *Setup that borrows the machine.* The test uses shared paths, home configuration, or the system clock. Create what it needs and remove it afterwards, or fake it.
- *A real call used for convenience.* Realism or setup speed is the reason. Those never qualify; fake it.

**Where to go.** Tests fake every real subsystem. The rare test whose subject is a subsystem's own behaviour brings its own instance and removes it.

**Reactions to distrust.**
- "It works on my machine." That is the problem: it depends on your machine.
- "Faking it is more work." Once per subsystem, against every developer's environment being at risk.

**Principles behind it.**
- *Hermetic tests.* A test depends only on what it creates, so its result is the same on every machine.
- *Erratic Test* (a test smell in Gerard Meszaros, *xUnit Test Patterns*). Tests that share or leak real resources pass or fail by circumstance.
