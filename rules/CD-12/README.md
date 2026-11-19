# CD-12: Repositories are the primary storage abstraction

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Recipe for [Ports declared inside](../rules.md#ports-declared-inside).

**Read.** [Ports declared inside](../rules.md#ports-declared-inside) and [Port in the domain](../typescript/recipes.md#port-in-the-domain).

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Port outside the domain](../typescript/symptoms.md#port-outside-the-domain). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
