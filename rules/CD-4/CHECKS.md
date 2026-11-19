# CD-4 checks

Recipe: [Zod at the producer's adapter](../typescript/recipes.md#zod-at-the-producers-adapter). The outcome it protects is seen by [Schema past its adapter](../typescript/symptoms.md#schema-past-its-adapter).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-4#boundary-validation` | review | every crossing from the untyped outside world is schema-validated at the seam |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the named rules](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
