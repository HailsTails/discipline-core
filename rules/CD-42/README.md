# CD-42: Unhappy paths are early returns; happy path is the final return

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Guard first](../rules.md#guard-first).

**Read.** [Guard first](../rules.md#guard-first) and [Guard clauses](../typescript/recipes.md#guard-clauses).

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Work inside a condition](../typescript/symptoms.md#work-inside-a-condition). Each symptom names the cases it may indicate and the rules they point at. The why is on [One place decides](../principles.md#one-place-decides).
