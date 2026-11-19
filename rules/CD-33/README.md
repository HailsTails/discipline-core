# CD-33: Sensitive types brand-redact unconditionally

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) says where each number went.

A value whose type is branded sensitive redacts unconditionally wherever it surfaces — logs, errors, serialisation — with no opt-out. Branding sensitivity into the type means the redaction travels with the value by construction, rather than depending on every call site remembering to hide it.

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Remembering to hide a secret at every call site fails eventually. The friction puts the redaction in the type, so it travels with the value.

**What a finding points at.** Match the sites against these causes.
- *Sensitive values as plain strings.* Tokens or keys are typed as strings. Brand them, so redaction follows by construction.
- *An escape to print the value.* A path exposes the raw value for convenience. Remove it; the rule has no opt-out.

**Where to go.** Every sensitive value has a branded type that redacts wherever it surfaces.

**Reactions to distrust.**
- "We need to see it sometimes." Then that is a deliberate operation at a boundary that needs the value, not a log line.

**Principles behind it.**
- *Make illegal states unrepresentable* (Yaron Minsky). A branded type cannot be printed in the clear by mistake.
- *Secure by default.* Redaction needs no action from the caller.
