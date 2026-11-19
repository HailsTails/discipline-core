# Principles

A principle is a why: what it protects and its reason to change. Each is stated in the same four lines: what must hold, what it protects, its reason to change, and where a breach sits.

The principles hold in combination, not one at a time. "The principles are not to hold my rulings on their own but in combination."

Principles name no language, tool or library. [Cases](cases.md) say what to do for each thing code is trying to do, and [rules](rules.md) say what must hold under each principle.

## Tests are ours

- **Must hold:** A test fails only when what the code it tests returns or calls changes.
- **Protects:** Red means "this unit broke" and nothing else.
- **Reason to change:** The world around the unit changes: a clock, a machine, a collaborator.
- **Breach:** In the unit that reads the world itself (also a breach of External behaviour sits at a boundary), or whose port cannot take a plain stub (also a breach of One place decides). Shows in the test: computed expectations, stubs with logic, module mocks, waits.
- **Rules under it:** [Written-out answers](rules.md#written-out-answers), [Straight-through tests](rules.md#straight-through-tests), [Tested where it's owned](rules.md#tested-where-its-owned).
- **Source:** Freeman and Pryce teach that you mock only types you own; this principle keeps tests on what is ours.

## One place decides

- **Must hold:** Each unit makes one decision, and each decision is made by one unit of ours.
- **Protects:** A change to one decision is one edit in one unit.
- **Reason to change:** A decision changes.
- **Breach:** In the unit holding a second decision, the second unit re-making one, or the library making one that is ours. Shows as long or nested functions, mode flags, a clock or id read inside a job that is not dating or numbering.
- **Rules under it:** [Doer or orchestrator](rules.md#doer-or-orchestrator), [Handed what it uses](rules.md#handed-what-it-uses), [Guard first](rules.md#guard-first), [One reason per module](rules.md#one-reason-per-module).
- **Source:** Parnas hides each decision that may change inside one module; Martin gathers what changes for the same reason.

## No hidden effects

- **Must hold:** A unit changes nothing: it gives back the value it returns and calls ports passed in to it.
- **Protects:** Every effect is visible at the call site, and no unit works by holding state and changing it.
- **Reason to change:** What a call affects changes.
- **Breach:** In the function that writes to something it was not passed, changes its input, or changes a value of its own after making it. Shows as tests that patch a global to see an effect.
- **Rules under it:** none. The principle decides.
- **Source:** This is Bernhardt's functional core, imperative shell: decisions stay pure and effects stay in sight.

## External behaviour sits at a boundary

- **Must hold:** Business logic calls only other business logic, ports passed in to it, and operations that depend on nothing but their arguments and change nothing.
- **Protects:** A change in a service, a runtime, a clock or a protocol never edits business logic.
- **Reason to change:** The thing we call changes its behaviour.
- **Breach:** In the business-logic file that makes the call. Shows as a vendor or adapter import in business logic, a module mock, or a result that differs per machine.
- **Rules under it:** [Outside dependencies stay at boundaries](rules.md#outside-dependencies-stay-at-boundaries), [Ports declared inside](rules.md#ports-declared-inside).
- **Source:** This is Cockburn's ports and adapters, and Martin's rule that dependencies point inwards.

## No leak across a boundary

- **Must hold:** Data and failures cross a boundary only through an adapter that maps between their outside form and a type of our own.
- **Protects:** A sender's change of shape stops at the adapter.
- **Reason to change:** The shape of the data we receive changes.
- **Breach:** In the adapter that is missing or passes the outside form inward. Shows far inward: presence checks, re-parsing, casts.
- **Outside data:** anything read at a boundary, our own stored rows and files included.
- **Record:** an externally defined model adopted as the definitive thing. Evans's *Conformist*. It is a statement on a [boundary record](records.md#boundary-record).
- **Rules under it:** none. The principle decides.
- **Source:** This is Evans's anticorruption layer, applied to failures as well as data, in both directions.

## The type checker proves it

- **Must hold:** Every fact the code relies on about a value is proven by the type checker.
- **Protects:** A wrong shape, an unhandled case or an unhandled failure fails the build, not production.
- **Reason to change:** A type gains a case or changes shape.
- **Breach:** At the declaration that admits too much. Shows at uses: casts.
- **Rules under it:** [Failures are values](rules.md#failures-are-values), [Declared, not asserted](rules.md#declared-not-asserted), [Kinds are named](rules.md#kinds-are-named).
- **Source:** Minsky makes illegal states unrepresentable; King parses once at the edge, so the types carry the proof.

## Our code reads in the common language

- **Must hold:** The meaning of our code is carried only by language constructs engineers in the space already know and by the domain's own names.
- **Protects:** An engineer reads our code knowing two languages only: the programming language and the domain.
- **Reason to change:** Who reads the code changes.
- **Breach:** At the declaration or call that borrows a library's vocabulary or leaves meaning to prose. Shows as comments and utility-type outside dependencies.
- **Rules under it:** [One word everywhere](rules.md#one-word-everywhere).
- **Source:** This is Evans's ubiquitous language, held across the whole codebase rather than one context.

## Outside risk is carried on purpose

- **Must hold:** No outside code or tool is used by us, or changes version, except by a recorded decision of ours.
- **Protects:** The upkeep we carry for other people's code (upgrades, vulnerabilities, drift) is upkeep we chose.
- **Reason to change:** The risk an outside party's code puts on our upkeep changes: a release, a vulnerability, a compromise, an abandoned project.
- **Breach:** In the manifest, the lock file, the pipeline or a vendored copy. Shows as an outside dependency with no record, a version that floats, a tool fetched at run time, a copy of upstream code that has drifted.
- **Differs from External behaviour sits at a boundary:** that principle keeps an outside change from editing business logic. This one decides whether the outside thing is here at all, and at which version.
- **Rules under it:** [Outside dependencies justified](rules.md#outside-dependencies-justified), [Fixed versions](rules.md#fixed-versions), [Tools live in the repo](rules.md#tools-live-in-the-repo), [Upstream stays untouched](rules.md#upstream-stays-untouched). Proposed, not accepted: [Shipped risk declared](rules.md#shipped-risk-declared).
- **Source:** This follows Twelve-Factor, OpenSSF and the SBOM: every dependency is declared, pinned and recorded.

## Not principles

- **Failures as values.** A rule under The type checker proves it.
- **Sensitive data.** Its rules stand on their own with safety as their why.
- **Determinism.** The test half is in Tests are ours ("inputs the test writes out"). The other half is in One place decides (one unit dates, one numbers) and External behaviour sits at a boundary (a clock depends on more than its arguments).
- **Reasons to change.** The test that says what one decision is, not a principle.
