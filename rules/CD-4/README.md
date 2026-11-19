# CD-4: Zod at every external boundary

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Recipe for the No leak case: [Zod at the producer's adapter](../typescript/recipes.md#zod-at-the-producers-adapter).

**Read.** [Zod at the producer's adapter](../typescript/recipes.md#zod-at-the-producers-adapter) and Reads data from outside ([cases](../cases.md#no-leak-across-a-boundary)).

Review lens: [zod-boundary](../../methods/lenses/zod-boundary.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Schema past its adapter](../typescript/symptoms.md#schema-past-its-adapter). Each symptom names the cases it may indicate and the rules they point at. The why is on [No leak across a boundary](../principles.md#no-leak-across-a-boundary).
