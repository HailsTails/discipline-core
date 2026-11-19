# CD-44: Functions must not mutate fields of parameters they receive

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases of [No hidden effects](../principles.md#no-hidden-effects).

**Read.** [No hidden effects](../principles.md#no-hidden-effects) and [Copy, never write in](../typescript/recipes.md#copy-never-write-in).

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Write into a parameter](../typescript/symptoms.md#write-into-a-parameter) and [Rebinding](../typescript/symptoms.md#rebinding). Each symptom names the cases it may indicate and the rules they point at. The why is on [No hidden effects](../principles.md#no-hidden-effects).
