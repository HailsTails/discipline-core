# CD-45: Zod runs exactly once per external-boundary crossing

## Rule

Validation runs exactly once, at the boundary crossing, and yields a plain internal shape the rest of the code trusts by construction — it is never re-run deeper in, and the validation library's types never leak inward. Parse once at the seam, map to a domain shape, and let the inner layers depend on that shape, not on the validator.

Review lens: [zod-boundary](../../methods/lenses/zod-boundary.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** Checking the same data twice means nobody trusts the first check, and the validator's types spread inward. The friction makes parsing once and handing on a plain shape the easy path.

**What a finding points at.** Match the sites against these causes.
- *A boundary that does not finish its job.* The seam parses but passes the raw or validator-typed value on. Map it to a plain domain shape there.
- *Inner code that does not trust its inputs.* Inner functions parse again. Give them the parsed type so the check is unnecessary.
- *Validator types used as domain types.* The validation library's types appear in inner signatures. Declare your own types; the boundary maps to them.

**Where to go.** One parse per crossing, at the seam. Inner layers depend on your own types, never on the validator.

**Reactions to distrust.**
- "Parsing again is safer." It is a sign the types inside cannot be trusted. Fix that instead.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). After one parse the type carries the proof; checking again adds nothing.
- *Dependency Inversion Principle* (Robert C. Martin, SOLID). Inner layers depend on their own types, not on a library's.
