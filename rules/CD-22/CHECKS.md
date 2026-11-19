# CD-22 checks

Recipe: [Bounded context generic](../typescript/recipes.md#bounded-context-generic). The outcome it protects is seen by [Default for a required value](../typescript/symptoms.md#default-for-a-required-value).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-22#middleware-context` | review | middleware reads its context through a constrained generic, not an open property bag |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the named rules](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
