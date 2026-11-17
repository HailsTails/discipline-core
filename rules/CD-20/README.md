# CD-20: Runtime stdlib imports arrive through injected ports

## Rule

Collapsed into [CD-19](../CD-19/README.md) — confining the
runtime's own standard library behind a wrapping port is the same intent as
confining a third-party dependency (CD-20 was originally split out of CD-19). CD-19
now covers both third-party and stdlib dependencies. This id is retained as a
redirect so existing citations resolve; it is not independently enforced.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

See [CD-19's Spirit section](../CD-19/README.md#spirit). A runtime standard-library import is the same signal as any other unwrapped dependency: a capability with no port.
