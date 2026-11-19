# CD-43: Booleans are evaluative, not declarative

## Rule

This numbered page is the earlier form of this rule. The [named pages](../README.md) govern where they differ, and [Every CD](../numbers.md) maps each number to its names.

**Verdict.** Keeps: [Kinds are named](../rules.md#kinds-are-named).

**Read.** [Kinds are named](../rules.md#kinds-are-named) and [Tagged union and exhaustive switch](../typescript/recipes.md#tagged-union-and-exhaustive-switch).

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

Start from the symptom a finding names: [Boolean in a signature](../typescript/symptoms.md#boolean-in-a-signature). Each symptom names the cases it may indicate and the rules they point at. The why is on [The type checker proves it](../principles.md#the-type-checker-proves-it).
