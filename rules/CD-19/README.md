# CD-19: External dependencies confined to wrapping ports at the boundary

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Splits: Outside dependencies stay at boundaries; Ports declared inside; construction and ids cases.

**Read.** [Outside dependencies stay at boundaries](../rules.md#outside-dependencies-stay-at-boundaries), [Ports declared inside](../rules.md#ports-declared-inside) and [Adapter per outside party](../typescript/recipes.md#adapter-per-outside-party).

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Outside import past a boundary](../typescript/symptoms.md#outside-import-past-a-boundary) and [Outside type in a signature](../typescript/symptoms.md#outside-type-in-a-signature). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
