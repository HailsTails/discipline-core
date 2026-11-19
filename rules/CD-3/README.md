# CD-3: Strict mode flags inherited, never overridden

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases: strictest checker setting.

**Read.** Sets how strictly the checker works ([cases](../cases.md#the-type-checker-proves-it)) and [Shared strict base config](../typescript/recipes.md#shared-strict-base-config).

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Strictness weakened](../typescript/symptoms.md#strictness-weakened). Each symptom names the cases it may indicate and the rules they point at. The why is on [The type checker proves it](../principles.md#the-type-checker-proves-it).
