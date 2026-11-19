# CD-15: Iteration is functional transformation, never an imperative loop

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases of [No hidden effects](../principles.md#no-hidden-effects).

**Read.** [No hidden effects](../principles.md#no-hidden-effects), Makes a new value from what it has ([cases](../cases.md#no-hidden-effects)) and [Functional iteration](../typescript/recipes.md#functional-iteration).

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Loop keyword](../typescript/symptoms.md#loop-keyword). Each symptom names the cases it may indicate and the rules they point at. The why is on [No hidden effects](../principles.md#no-hidden-effects).
