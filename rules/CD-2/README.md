# CD-2: Closed enumerated list of permitted cast sites

## Rule

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it, each one an exception record for the file at that boundary. Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A cast is a claim the compiler cannot check. The friction makes the honest route, parsing the value or fixing its type, the easy one. The few claims that remain are visible and sit in known places.

**What a finding points at.** Match the sites against these causes.
- *Parsing skipped at a boundary.* Raw input is asserted into shape instead of checked. Parse it once where it enters and the type follows.
- *A declared type that is wrong.* The code builds something its type does not describe. Fix the declaration and the cast goes.
- *A boundary that is missing.* Casts cluster around one library or data source across many files. Make one wrapping file the boundary and keep the rest cast-free.
- *A return type wider than its use.* A function returns a broad type and every caller narrows it. Return the narrow type.
- *A parameter type wider than its use.* A function asks for a whole record but reads two fields. It shows in tests, where someone casts a two-field object through to the full type rather than build it all. The function asks for more than it needs. Accept only the fields it uses; the test then builds those two fields honestly.

**Where to go.** Casts live only in a few named boundary files, each recorded as an authorised location. Clean boundaries make that cheap; that is what authorised locations are for. Everywhere else the type follows from a check.

**Reactions to distrust.**
- "It's just tests." Tests are violations too. A test that casts is building a value its type does not allow. Either build it properly, or the unit asks for more than it uses.
- "Add a permission for this shape." Measure first. A permission can hide a real defect, such as database rows that were never parsed.
- "The library forces it." It forces one site. Put that site in the wrapping file.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). A parse produces the type; a cast only claims it. Parse once at the boundary and the claim is never needed.
- *Interface Segregation Principle* (Robert C. Martin, SOLID). Depend only on what you use. A parameter that asks for exactly the fields it reads needs no cast to satisfy, in production or in tests.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). The adapter at the edge is where outside shapes are translated, so it is the one place an unavoidable assertion belongs.
