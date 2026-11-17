# CD-24: Every file is unit-tested

## Rule

Collapsed into [CD-23](../CD-23/README.md) — "every file is unit-tested"
and "tests are co-located" are one intent: every unit has a co-located test
sibling. The enforcing walker already computes them as a single check. CD-23 now
carries both. This id is retained as a redirect so existing citations resolve; it
is not independently enforced.

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

See [CD-23's Spirit section](../CD-23/README.md#spirit). "Every file is unit-tested" and "tests are co-located" are one signal: a unit without its own stated purpose.
