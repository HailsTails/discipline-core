# CD-41: Orchestrators contain only orchestration

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Doer or orchestrator](../rules.md#doer-or-orchestrator).

**Read.** [Doer or orchestrator](../rules.md#doer-or-orchestrator) and [Composed orchestrator](../typescript/recipes.md#composed-orchestrator).

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Long function](../typescript/symptoms.md#long-function), [Tangled function](../typescript/symptoms.md#tangled-function) and [Orchestrator that computes](../typescript/symptoms.md#orchestrator-that-computes). Each symptom names the cases it may indicate and the rules they point at. The why is on [One place decides](../principles.md#one-place-decides).
