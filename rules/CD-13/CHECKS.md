# CD-13 checks

Symptom: [Inner layer imports outer](../typescript/symptoms.md#inner-layer-imports-outer).

Read [the rule and its spirit](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-13#layer-boundaries` | review | dependencies point inward and an inner layer never imports an outer one |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the rule](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
