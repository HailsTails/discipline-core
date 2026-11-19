# CD-9: All operational failures return Result<T, E>

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Failures are values](../rules.md#failures-are-values).

**Read.** [Failures are values](../rules.md#failures-are-values) and [Result union](../typescript/recipes.md#result-union).

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Throw between our units](../typescript/symptoms.md#throw-between-our-units) and [Failure shaped as success](../typescript/symptoms.md#failure-shaped-as-success). Each symptom names the cases it may indicate and the rules they point at. The why is on [The type checker proves it](../principles.md#the-type-checker-proves-it).
