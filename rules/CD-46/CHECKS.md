# CD-46 checks

Record kind: [Debt](../records.md#debt).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## How it is checked

This discipline has no clauses to select: the check applies it to every file carve-out. Run the check with `--base-revision`, and a `file-carve-out` record whose file changed since that revision is forfeited, so its findings come back and the run fails until the file is clean and the record is removed. Without `--base-revision`, any file carve-out makes the report list `forfeiture-unmeasured` and the run fails. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).
