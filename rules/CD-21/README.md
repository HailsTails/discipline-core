# CD-21: Every injected port ships a default production factory

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases: built at the entry point.

**Read.** Builds the real implementations ([cases](../cases.md#one-place-decides)) and [Composition root](../typescript/recipes.md#composition-root).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Adapter built outside the root](../typescript/symptoms.md#adapter-built-outside-the-root). Each symptom names the cases it may indicate and the rules they point at. The why is on [One place decides](../principles.md#one-place-decides).
