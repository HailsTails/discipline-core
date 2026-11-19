# CD-17: Clock is the only time source

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Cases under Handed what it uses and One reason per module.

**Read.** [Handed what it uses](../rules.md#handed-what-it-uses), [One reason per module](../rules.md#one-reason-per-module), Needs the current time, a random value, a new id or an outside ordering ([cases](../cases.md#external-behaviour-sits-at-a-boundary)) and [World values through a port](../typescript/recipes.md#world-values-through-a-port).

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Date used directly](../typescript/symptoms.md#date-used-directly). Each symptom names the cases it may indicate and the rules they point at. The why is on [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary), [One place decides](../principles.md#one-place-decides) and [Tests are ours](../principles.md#tests-are-ours).
