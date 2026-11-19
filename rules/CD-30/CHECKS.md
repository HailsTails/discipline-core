# CD-30 checks

Symptom: [Behaviour tested away from its owner](../typescript/symptoms.md#behaviour-tested-away-from-its-owner).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-30#composition-only` | review | an integration test targets the wiring between units, not their logic |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies [the named rules](README.md) with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
