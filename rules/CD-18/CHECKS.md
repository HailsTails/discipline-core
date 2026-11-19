# CD-18 checks

Symptom: [Process global used in place](../typescript/symptoms.md#process-global-used-in-place).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-18#process-lifecycle-ports` | review | process signals, exit, kill and high-resolution timing arrive through an injected port |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the named rules](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
