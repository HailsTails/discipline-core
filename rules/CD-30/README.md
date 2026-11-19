# CD-30: Integration tests catch composition bugs only

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Merges into [Tested where it's owned](../rules.md#tested-where-its-owned).

**Read.** [Tested where it's owned](../rules.md#tested-where-its-owned) and [Integration test suffix](../typescript/recipes.md#integration-test-suffix).

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Behaviour tested away from its owner](../typescript/symptoms.md#behaviour-tested-away-from-its-owner). Each symptom names the cases it may indicate and the rules they point at. The why is on [Tests are ours](../principles.md#tests-are-ours).
