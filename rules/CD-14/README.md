# CD-14: Zero class authoring; classes only at external-library call sites

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Splits: no-class recipe; Outside dependencies stay at boundaries; state a case.

**Read.** [Closure factory](../typescript/recipes.md#closure-factory), [Outside dependencies stay at boundaries](../rules.md#outside-dependencies-stay-at-boundaries) and Keeps state or settings across calls ([cases](../cases.md#no-hidden-effects)).

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Authored class or this](../typescript/symptoms.md#authored-class-or-this) and [Library class built in place](../typescript/symptoms.md#library-class-built-in-place). Each symptom names the cases it may indicate and the rules they point at. The why is on [No hidden effects](../principles.md#no-hidden-effects) and [External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary).
