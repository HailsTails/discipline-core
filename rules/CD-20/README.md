# CD-20: Runtime stdlib imports arrive through injected ports

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Merges with CD-19.

**Read.** [Outside dependencies stay at boundaries](../rules.md#outside-dependencies-stay-at-boundaries), [Ports declared inside](../rules.md#ports-declared-inside) and [Adapter per outside party](../typescript/recipes.md#adapter-per-outside-party).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Outside import past a boundary](../typescript/symptoms.md#outside-import-past-a-boundary). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
