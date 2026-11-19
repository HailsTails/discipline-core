# CD-12 checks

Recipe: [Port in the domain](../typescript/recipes.md#port-in-the-domain). The outcome it protects is seen by [Port outside the domain](../typescript/symptoms.md#port-outside-the-domain).

Read [the rule and its spirit](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-12#repository-ports` | review | storage sits behind a repository port and domain code never imports a storage driver |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the rule](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
