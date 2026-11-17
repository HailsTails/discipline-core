# CD-18: Process-lifecycle operations arrive through an injected port

## Rule

Process-lifecycle side effects — signal handlers, exit, kill, high-resolution timing — are a capability that arrives through an injected port, not reached for ambiently on the runtime's process global. Confining them behind a port makes lifecycle behaviour composable and replaceable with a test double in tests, instead of a hidden dependency on the running process.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Exiting, handling signals and reading process timers are side effects on the running program. The friction makes them a port the code receives, so lifecycle behaviour can be composed and tested.

**What a finding points at.** Match the sites against these causes.
- *Exit called deep inside.* A function ends the process instead of returning. Return the outcome; let the entry point decide to exit.
- *Signal handling scattered.* Several modules register handlers. Gather lifecycle in one port wired at startup.
- *Timing read from the process.* Code measures time through the process global. Inject it.

**Where to go.** Lifecycle operations arrive through one injected port. Only the composition root touches the real process.

**Reactions to distrust.**
- "It's a CLI, exit is normal." Exit at the entry point. Everywhere else, return.

**Principles behind it.**
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). Code depends on a lifecycle abstraction, not the runtime global.
- *Functional core, imperative shell* (Gary Bernhardt). The decision to stop is a value; stopping happens at the shell.
