# CD-9: All operational failures return Result<T, E>

## Rule

Every expected, operational failure is modelled as data — a result-shaped return carrying a tagged error union that enumerates each way the operation can fail — not raised as an exception. Infrastructure failure is an operational outcome, not an escape into throwing. Callers dispatch on the error as a value, so no failure path is invisible in the type.

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A failure the type does not mention is a failure the caller will not handle. The friction makes returning failures as values the easy path, so every way an operation can fail is visible and handled.

**What a finding points at.** Match the sites against these causes.
- *Failures thrown because they were never listed.* Name each way the operation fails as a tagged variant.
- *Infrastructure treated as exceptional.* Timeouts and missing records are thrown. They are ordinary outcomes; return them.
- *Library exceptions leaking.* Catch at the wrapping boundary and return a result.
- *Callers that ignore failure.* A result is unwrapped without looking at the error. Handle each variant.

**Where to go.** Every operation that can fail returns a result with a tagged error union, and callers dispatch on it.

**Reactions to distrust.**
- "Exceptions are simpler." Simpler to write, because they skip the handling. The handling is the point.

**Principles behind it.**
- *Railway oriented programming* (Scott Wlaschin). Success and failure travel as two tracks of one value.
- *Make illegal states unrepresentable* (Yaron Minsky). A tagged error union lists exactly the failures that can occur.
