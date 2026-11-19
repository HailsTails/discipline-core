# CD-27: Tests are zero-everything — zero logic, zero branches, zero unpredictability

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Splits: Straight-through tests; Tested where it's owned.

**Read.** [Straight-through tests](../rules.md#straight-through-tests), [Tested where it's owned](../rules.md#tested-where-its-owned), [Assert to narrow](../typescript/recipes.md#assert-to-narrow), [it.each over typed rows](../typescript/recipes.md#iteach-over-typed-rows) and [Whole written-out expectation](../typescript/recipes.md#whole-written-out-expectation).

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Branch in a test](../typescript/symptoms.md#branch-in-a-test), [Computed value in a test](../typescript/symptoms.md#computed-value-in-a-test), [Rebinding](../typescript/symptoms.md#rebinding), [Text past its reader](../typescript/symptoms.md#text-past-its-reader) and [Test switched off](../typescript/symptoms.md#test-switched-off). Each symptom names the cases it may indicate and the rules they point at. The why is on [Tests are ours](../principles.md#tests-are-ours).
