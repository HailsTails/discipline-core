# CD-2: Closed enumerated list of permitted cast sites

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Declared, not asserted](../rules.md#declared-not-asserted).

**Read.** [Declared, not asserted](../rules.md#declared-not-asserted) and [Fix the declaration, not the value](../typescript/recipes.md#fix-the-declaration-not-the-value).

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Claimed type](../typescript/symptoms.md#claimed-type). Each symptom names the cases it may indicate and the rules they point at. The why is on [The type checker proves it](../principles.md#the-type-checker-proves-it).
