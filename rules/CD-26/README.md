# CD-26: No module-mocking — module-mock means DI is wrong

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Symptom of Written-out answers, Ports declared inside.

**Read.** [Written-out answers](../rules.md#written-out-answers), [Ports declared inside](../rules.md#ports-declared-inside) and [Ports in the argument](../typescript/recipes.md#ports-in-the-argument).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Module or global patched](../typescript/symptoms.md#module-or-global-patched). Each symptom names the cases it may indicate and the rules they point at. The why is on [Tests are ours](../principles.md#tests-are-ours) and [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
