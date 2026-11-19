# CD-25: Unit tests replace everything outside the unit with test doubles

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Written-out answers](../rules.md#written-out-answers).

**Read.** [Written-out answers](../rules.md#written-out-answers) and [Stub with vi.fn](../typescript/recipes.md#stub-with-vifn).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Double with a body](../typescript/symptoms.md#double-with-a-body) and [Unasserted call](../typescript/symptoms.md#unasserted-call). Each symptom names the cases it may indicate and the rules they point at. The why is on [Tests are ours](../principles.md#tests-are-ours).
