# CD-7a: No ReturnType<typeof X> for our own codebase

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Symptom of [Outside dependencies stay at boundaries](../rules.md#outside-dependencies-stay-at-boundaries).

**Read.** [Outside dependencies stay at boundaries](../rules.md#outside-dependencies-stay-at-boundaries) and [Named, exported type](../typescript/recipes.md#named-exported-type).

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Type derived from code](../typescript/symptoms.md#type-derived-from-code). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary) and [The type checker proves it](../principles.md#the-type-checker-proves-it).
