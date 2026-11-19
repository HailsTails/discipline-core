# CD-47: Tests are hermetic — no real side effects on anything real

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases under [Tested where it's owned](../rules.md#tested-where-its-owned).

**Read.** [Tested where it's owned](../rules.md#tested-where-its-owned) and [Integration test owns its scratch](../typescript/recipes.md#integration-test-owns-its-scratch).

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Inherited environment in a subprocess](../typescript/symptoms.md#inherited-environment-in-a-subprocess) and [Machine touched in a unit test](../typescript/symptoms.md#machine-touched-in-a-unit-test). Each symptom names the cases it may indicate and the rules they point at. The why is on [Tests are ours](../principles.md#tests-are-ours).
