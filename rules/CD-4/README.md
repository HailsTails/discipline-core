# CD-4: Zod at every external boundary

## Rule

Every crossing from the untyped outside world — HTTP, environment, files, database rows, inter-process input — is validated by a schema at the seam and handed inward as plain typed data. The boundary is the one place the program does not yet know the shape of its input; parse it there, once, so everything deeper can trust its types.

Review lens: [zod-boundary](../../methods/lenses/zod-boundary.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** The boundary is the one place the program does not know the shape of what it receives. The friction makes checking it there the easy path, so everything inside can trust its types.

**What a finding points at.** Match the sites against these causes.
- *Input trusted on arrival.* A request, file, environment value, or database row is used as if typed. Parse it with a schema at the seam.
- *No clear seam.* Outside data enters in many places. Gather each source behind one adapter that parses it.
- *Checks scattered inward.* Inner code tests fields for presence. That means nothing parsed at the edge; move the check there.

**Where to go.** Every outside source has one seam that parses it into plain typed data. Nothing inside checks shape again.

**Reactions to distrust.**
- "It's our own database." It is still outside the type system. Rows can be anything the schema has ever allowed.
- "The client already validates." The server cannot rely on code it does not run.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). Parsing produces a typed value once; validation leaves the raw value to be checked again.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). Each outside system enters through one adapter, which is where its data is translated.
