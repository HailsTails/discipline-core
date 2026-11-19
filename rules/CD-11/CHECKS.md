# CD-11 checks

Recipe: [Result union](../typescript/recipes.md#result-union). The outcome it protects is seen by [Failure shaped as success](../typescript/symptoms.md#failure-shaped-as-success).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-11#error-envelopes` | review | operational errors are tagged data built by a factory and dispatched on their tag |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the named rules](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
