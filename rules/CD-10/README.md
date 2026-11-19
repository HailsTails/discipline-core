# CD-10: Throws permitted in exactly two contexts

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Splits: Failures are values; Straight-through tests; throw-only-error a check.

**Read.** [Failures are values](../rules.md#failures-are-values), [Straight-through tests](../rules.md#straight-through-tests), [Failure asserted as a value](../typescript/recipes.md#failure-asserted-as-a-value) and [Failure mapping at the adapter](../typescript/recipes.md#failure-mapping-at-the-adapter).

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Throw or catch in a test](../typescript/symptoms.md#throw-or-catch-in-a-test) and [Thrown non-error](../typescript/symptoms.md#thrown-non-error). Each symptom names the cases it may indicate and the rules they point at. The why is on [The type checker proves it](../principles.md#the-type-checker-proves-it) and [Tests are ours](../principles.md#tests-are-ours).
