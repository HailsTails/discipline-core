# CD-41: Orchestrators contain only orchestration

## Rule

An orchestrator's body composes helper calls and assembles their results — nothing else. Inline branching or computation inside an orchestrator mixes two altitudes: the coordination it owns and the logic that belongs in a named helper. Keep orchestrators pure coordination so each level reads at one altitude.

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A function that coordinates and computes at once has to be read at two levels of detail at once. The friction makes small named steps the easy shape, so each level reads as one idea.

**What a finding points at.** Match the sites against these causes.
- *Logic that never got a name.* A block of branching or computation sits inside a coordinator. Extract it into a named helper; the name says what it decides.
- *One function with several jobs.* It validates, decides and performs, so it grows long and tangled. Split it by job.
- *Failures checked inline.* Nesting deepens because each failure is handled in place. Return early on failure, or let helpers return results the coordinator only routes.
- *Shapes that do not meet.* The coordinator reshapes data between calls because its helpers disagree. Align the helpers' inputs and outputs.

**Where to go.** Coordinators read as a short list of named steps. Each helper does one thing at one level of detail.

**Reactions to distrust.**
- "Raise the threshold." The threshold is the alarm, not the fire. The extraction is the fix.
- "Splitting makes it harder to follow." Named steps read faster than inline logic once the names are honest.
- "It's only a little over." Length and complexity point at a second job. Find it.

**Principles behind it.**
- *Composed Method* (Kent Beck, *Smalltalk Best Practice Patterns*). A method is a sequence of calls to other methods, all at the same level of abstraction.
- *One level of abstraction per function* (Robert C. Martin, *Clean Code*). Mixing coordination with detail forces the reader to switch levels mid-function.
- *Single Responsibility Principle* (Robert C. Martin, SOLID). A function with one reason to change stays short without trying.
