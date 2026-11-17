# CD-16: No counted for loops

## Rule

Collapsed into [CD-15](../CD-15/README.md) — counted-loop iteration and
element iteration are two faces of the same intent (iteration is functional
transformation, not imperative looping). CD-15 now carries both. This id is
retained as a redirect so existing citations resolve; it is not independently
enforced.

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

See [CD-15's Spirit section](../CD-15/README.md#spirit). A counted loop is the same signal as any other loop, plus a manual index that can drift out of bounds.
