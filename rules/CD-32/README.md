# CD-32: PII strings redact-by-default in structured logs

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) says where each number went.

Structured logs redact personally-identifying data by default; a field becomes loggable only by explicitly opting in as safe. Redaction is the default so a new field is never accidentally leaked into logs — safety is the resting state, exposure the deliberate exception.

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A log field added in a hurry should not leak personal data. The friction makes redaction the resting state, so exposure takes a deliberate decision.

**What a finding points at.** Match the sites against these causes.
- *Logging whole objects.* Records are logged as they are, carrying every field. Log named, safe fields.
- *Safe-listing by habit.* Fields are opted in without thought. Each opt-in is a decision; record why the field is safe.

**Where to go.** Logs redact personal data by default; only fields explicitly marked safe appear.

**Reactions to distrust.**
- "We need it for debugging." Then log an identifier that leads to it, not the data.

**Principles behind it.**
- *Secure by default.* The safe state needs no action; the risky one needs a decision.
- *Privacy by design* (Ann Cavoukian). Protection of personal data is built into the system, not added later.
