# How to read the rules

A finding names a symptom. Read it along the chain:

**symptom → case → why → reason to change**

A [symptom](typescript/symptoms.md) is what was seen in the code. It points at the [cases](cases.md) it may indicate: what the code was trying to do. Each case owes one or more whys, its [principles](principles.md), and each principle names its reason to change. The [rules](rules.md) under a principle say what must hold, and the [recipes](typescript/recipes.md) are the known methods that make a rule hold.

## Why these rules are strict

"my rules are stricter than most because leaving any trade off or judgement based calls to llm leads to the easiest option locally. Which is almost never the better choice."

So no principle or rule leaves a trade-off or a judgement call to the reader. It states what must hold. The room for a correct exception is a record, never softness in the text. Being stricter than a cited source is intended.

## The model

| Kind | What it is | Industry name |
|---|---|---|
| [Principle](principles.md) | A why. What it protects and its reason to change. | Rationale |
| [Case](cases.md) | What the code is trying to do ("this needs the current time"). Where the why is owed. | Problem in context |
| [Rule](rules.md) | What must hold. Carries no exceptions. | Requirement |
| [Recipe](typescript/recipes.md) | A known method that makes a rule hold, with the reason it was chosen. "It's as binding as it's reasoning. The proof of burden is on the deviation to show that the reason it was chosen no longer holds." | Acceptable means of compliance; pattern |
| [Symptom](typescript/symptoms.md) | Something seen in code. Suspect by default. May point at several rules. | Code smell |
| [Check](typescript/checks.md) | How a symptom is found. Imperfect by design. | Enforcement; fitness function |
| [Record](records.md) | A thought-through use, known debt, or a design decision. | Deviation record; ADR |

"Reasons to change" is not on the list. It is the test used to place a boundary and to decide whether two things are one.

## The language boundary

Principles, cases and rules are cross-language. Recipes, symptoms and checks are written for one language; TypeScript is the one today, under [typescript](typescript/symptoms.md).

Two tests for a rule:
1. It names no language feature. If it only makes sense because of a quirk of the language, it is a symptom or a recipe for that language.
2. The other rules together do not already give it. If they do, it is a case.

## Names, not numbers

Rules, principles, cases, recipes and symptoms are named, not numbered. A name's id is the name, hyphenated. [Every CD](numbers.md) maps each old number to its new names. Selections, records and findings still use the numbered clause addresses, and each numbered folder still holds its discipline's `CHECKS.md`.

## Words used the same way everywhere

- **Business logic:** all code outside a recorded boundary.
- **Unit:** one function.
- **Port:** an interface of ours that business logic is handed.
- **Adapter:** a unit inside a recorded boundary that fulfils a port.
- **Passed in:** given as an argument or to the factory that built the unit. Never imported.
- **One decision:** one reason to change.
- **Package:** an outside dependency. An internal package is our own code.

## The pages

| Page | What it holds |
|---|---|
| [principles.md](principles.md) | The principles, each with what must hold, what it protects, its reason to change and where a breach sits |
| [cases.md](cases.md) | The cases under each principle, the whys each owes, and what to do |
| [rules.md](rules.md) | The named rules |
| [records.md](records.md) | The record kinds, and today's record formats beside them |
| [sources.md](sources.md) | The sources behind each principle, rule, recipe and record kind |
| [typescript/recipes.md](typescript/recipes.md) | The recipes for TypeScript |
| [typescript/symptoms.md](typescript/symptoms.md) | The symptoms in TypeScript, and how near today's checks come |
| [typescript/checks.md](typescript/checks.md) | Each check, its margin and its settings |
| [numbers.md](numbers.md) | Every CD number and its new names |

## Selecting checks

Adopters select clauses in `disciplines.json`. Selecting one clause adopts its discipline, so every mechanical clause of an adopted discipline must be selected, each through a mechanism its `CHECKS.md` lists, or listed as `"not-adopted"`; the check reports the rest as uncovered. Review clauses are judgement clauses: they cannot be selected and are applied in review with the discipline's review lens, as [ADOPTING.md](../ADOPTING.md#9-apply-the-judgement-rules) describes.

Exceptions are recorded in `discipline-exceptions.json`; see [the package README](../README.md#discipline-exceptionsjson). [The spirit of the rules](SPIRIT.md) explains what the friction is for.
