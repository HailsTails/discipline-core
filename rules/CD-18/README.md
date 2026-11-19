# CD-18: Process-lifecycle operations arrive through an injected port

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases under [Ports declared inside](../rules.md#ports-declared-inside).

**Read.** [Ports declared inside](../rules.md#ports-declared-inside) and [World values through a port](../typescript/recipes.md#world-values-through-a-port).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Process global used in place](../typescript/symptoms.md#process-global-used-in-place). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
