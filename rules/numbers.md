# Every CD

Rules, principles, cases, recipes and symptoms are named, not numbered. This is the one page that gives the old numbers: each CD, its verdict, and where it went. Selections, records and findings still use the numbered clause addresses.

| Verdict | Meaning |
|---|---|
| Keeps | A rule under one principle. |
| Merges | Same reason to change as another rule. |
| Splits | Holds two principles. |
| Recipe | A method for another rule. |
| Cases | A list of cases of an existing rule or principle. |
| Symptom or Check | Something seen in code, or how it is found. |
| Outside | Outside the cases. |

| CD | Verdict | Where |
|---|---|---|
| [CD-1](CD-1/README.md) | Symptom | of [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-2](CD-2/README.md) | Keeps | [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-3](CD-3/README.md) | Cases | strictest checker setting |
| [CD-4](CD-4/README.md) | Recipe | for the No leak case: [Zod at the producer's adapter](typescript/recipes.md#zod-at-the-producers-adapter) |
| [CD-5](CD-5/README.md) | Splits | One word everywhere; Declared, not asserted; records |
| [CD-6](CD-6/README.md) | Keeps | [One word everywhere](rules.md#one-word-everywhere); casing a check |
| [CD-7](CD-7/README.md) | Splits | One reason per module; One word everywhere; filename case a check |
| [CD-7a](CD-7a/README.md) | Symptom | of [Packages stay at boundaries](rules.md#packages-stay-at-boundaries) |
| [CD-8](CD-8/README.md) | Symptom | of [Kinds are named](rules.md#kinds-are-named) |
| [CD-9](CD-9/README.md) | Keeps | [Failures are values](rules.md#failures-are-values) |
| [CD-10](CD-10/README.md) | Splits | Failures are values; Straight-through tests; throw-only-error a check |
| [CD-11](CD-11/README.md) | Recipe | for [Failures are values](rules.md#failures-are-values) |
| [CD-12](CD-12/README.md) | Recipe | for [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-13](CD-13/README.md) | Keeps | [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-14](CD-14/README.md) | Splits | no-class recipe; Packages stay at boundaries; state a case |
| [CD-15](CD-15/README.md) | Cases | of [No hidden effects](principles.md#no-hidden-effects) |
| [CD-16](CD-16/README.md) | Merges | with CD-15 |
| [CD-17](CD-17/README.md) | Cases | under Handed what it uses and One reason per module |
| [CD-18](CD-18/README.md) | Cases | under [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-19](CD-19/README.md) | Splits | Packages stay at boundaries; Ports declared inside; construction and ids cases |
| [CD-20](CD-20/README.md) | Merges | with CD-19 |
| [CD-21](CD-21/README.md) | Cases | built at the entry point |
| [CD-22](CD-22/README.md) | Recipe | for [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-23](CD-23/README.md) | Keeps | [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-24](CD-24/README.md) | Merges | with CD-23 |
| [CD-25](CD-25/README.md) | Keeps | [Written-out answers](rules.md#written-out-answers) |
| [CD-26](CD-26/README.md) | Symptom | of Written-out answers, Ports declared inside |
| [CD-27](CD-27/README.md) | Splits | Straight-through tests; Tested where it's owned |
| [CD-28](CD-28/README.md) | Merges | into [Written-out answers](rules.md#written-out-answers) |
| [CD-29](CD-29/README.md) | Merges | into [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-30](CD-30/README.md) | Merges | into [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-31](CD-31/README.md) | Check | of [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-32](CD-32/README.md) | Outside | safety |
| [CD-33](CD-33/README.md) | Outside | safety |
| [CD-34](CD-34/README.md) | Outside | safety |
| [CD-39](CD-39/README.md) | Outside | records |
| [CD-40](CD-40/README.md) | Cases | of One word everywhere, Handed what it uses |
| [CD-41](CD-41/README.md) | Keeps | [Doer or orchestrator](rules.md#doer-or-orchestrator) |
| [CD-42](CD-42/README.md) | Keeps | [Guard first](rules.md#guard-first) |
| [CD-43](CD-43/README.md) | Keeps | [Kinds are named](rules.md#kinds-are-named) |
| [CD-44](CD-44/README.md) | Cases | of [No hidden effects](principles.md#no-hidden-effects) |
| [CD-45](CD-45/README.md) | Cases | of [No leak across a boundary](principles.md#no-leak-across-a-boundary) |
| [CD-46](CD-46/README.md) | Outside | records |
| [CD-47](CD-47/README.md) | Cases | under [Tested where it's owned](rules.md#tested-where-its-owned) |

## Every mechanical clause

Each mechanical clause and the [symptom](typescript/symptoms.md) it sees.

| Clause | Symptom |
|---|---|
| CD-1 (3 clauses) | [Claimed type](typescript/symptoms.md#claimed-type); [Untyped value](typescript/symptoms.md#untyped-value) |
| CD-2 (2 clauses) | [Claimed type](typescript/symptoms.md#claimed-type) |
| CD-3 (7 clauses) | [Strictness weakened](typescript/symptoms.md#strictness-weakened) |
| CD-5 | [Untracked escape](typescript/symptoms.md#untracked-escape) |
| CD-6#identifier-names | [Shorthand name](typescript/symptoms.md#shorthand-name) |
| CD-6#naming-convention | [Name off its casing](typescript/symptoms.md#name-off-its-casing) |
| CD-7#categorical-paths | [Drawer path](typescript/symptoms.md#drawer-path) |
| CD-7#filename-case | [Name off its casing](typescript/symptoms.md#name-off-its-casing) |
| CD-7a | [Type derived from code](typescript/symptoms.md#type-derived-from-code) |
| CD-8 | [Default on a closed union](typescript/symptoms.md#default-on-a-closed-union) |
| CD-10#throws-in-tests | [Throw or catch in a test](typescript/symptoms.md#throw-or-catch-in-a-test) |
| CD-10#throw-only-error | [Thrown non-error](typescript/symptoms.md#thrown-non-error) |
| CD-14#class-syntax, CD-14#static-only-class | [Authored class or this](typescript/symptoms.md#authored-class-or-this) |
| CD-15 | [Loop keyword](typescript/symptoms.md#loop-keyword) |
| CD-17 | [Date used directly](typescript/symptoms.md#date-used-directly) |
| CD-19 | [Outside import past a boundary](typescript/symptoms.md#outside-import-past-a-boundary) |
| CD-23 | [Unit without a running test](typescript/symptoms.md#unit-without-a-running-test) |
| CD-25 | [Double with a body](typescript/symptoms.md#double-with-a-body) |
| CD-26 | [Module or global patched](typescript/symptoms.md#module-or-global-patched) |
| CD-27#test-body-logic | [Branch in a test](typescript/symptoms.md#branch-in-a-test); [Computed value in a test](typescript/symptoms.md#computed-value-in-a-test); [Rebinding](typescript/symptoms.md#rebinding); [Text past its reader](typescript/symptoms.md#text-past-its-reader) |
| CD-27#focused-tests, CD-27#skipped-tests | [Test switched off](typescript/symptoms.md#test-switched-off) |
| CD-40#parameter-count | [Positional parameters](typescript/symptoms.md#positional-parameters) |
| CD-41#cognitive-complexity | [Tangled function](typescript/symptoms.md#tangled-function) |
| CD-41#function-length | [Long function](typescript/symptoms.md#long-function) |
| CD-42 | [Work inside a condition](typescript/symptoms.md#work-inside-a-condition) |
| CD-43 | [Boolean in a signature](typescript/symptoms.md#boolean-in-a-signature) |
| CD-44#parameter-mutation | [Write into a parameter](typescript/symptoms.md#write-into-a-parameter) |
| CD-44#parameter-reassignment | [Rebinding](typescript/symptoms.md#rebinding) |
| CD-47 | [Inherited environment in a subprocess](typescript/symptoms.md#inherited-environment-in-a-subprocess) |

Review clauses that demand a method (CD-4, CD-9, CD-11, CD-12, CD-21 and CD-22) map to their [recipes](typescript/recipes.md). The outcome each protects is seen by Schema past its adapter, Throw between our units, Failure shaped as success, Port outside the domain, Adapter built outside the root and Default for a required value.

Sensitive data and citation clauses (CD-32, CD-33, CD-34 and CD-39) have no symptom: they are outside the cases.
