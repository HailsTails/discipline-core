# Rules

A rule states what must hold. It carries no exceptions. A rule's id is its name, hyphenated.

Each rule passes two tests: it names no language feature, and the other rules together do not already give it. Where a rule only restated its principle, it was dropped and the principle decides. The room for a correct exception is a [record](records.md), never softness in the text.

## Tests are ours

### Written-out answers

- **What must hold:** Every collaborator whose result the code under test uses is passed in; the test writes out each result it gives back, and checks what the code returns and every call it makes.
- **Cases served:** Uses what a collaborator gives back; Causes an effect (writes, logs, sends, exits); Needs the current time, a random value, a new id or an outside ordering.
- **Source:** Meszaros calls this Literal Value: the test states its inputs and answers in place.

### Straight-through tests

- **What must hold:** A test runs straight through: each case is distinct and complete, its input and expected output are written out in it as typed values, nothing in the test builds or picks them, nothing in it branches or catches, and no code of ours runs but the code under test.
- **Cases served:** States what the unit gives back, for one case or several; Checks a value that may be one of several outcomes.
- **Source:** Meszaros names branching in a test Conditional Test Logic; this rule removes it.

### Tested where it's owned

- **What must hold:** Every unit has a running test of its own in the file beside it, and no coverage figure stands in for it. Each behaviour is tested only at the level that owns it: a unit's logic in its own test, a binding to the outside in an integration test.
- **Cases served:** Gives each unit its test; Tests across units or against a real system.
- **Source:** This is Fowler's narrow integration test; Freeman and Pryce warn against mocks at boundary objects.

Both halves answer one reason to change, which test owns a behaviour, so it stays one rule written as two sentences. A test that inherits nothing from the machine is the principle's own must-hold, so it is a case, not a rule.

## One place decides

### Doer or orchestrator

- **What must hold:** An orchestrator only calls our own units, on one value or on each of several, and passes each result on, a failed one returned unchanged. A doer calls, or hands to anything that calls, no unit of ours but an adapter, reached through a port passed in.
- **Cases served:** Coordinates other units; Does one job.
- **Source:** This is Westphal's Integration Operation Segregation Principle.

### Handed what it uses

- **What must hold:** A unit is handed only what it uses: a port holds only the methods its one consumer calls; a doer takes only the fields it reads, or the entity whose module it is in; an orchestrator may pass an entity whole.
- **Cases served:** Does one job; Gives a value its type (declares it, or needs it narrower); Uses a system or service outside the program.
- **Source:** This is dependency injection, as Fowler describes it, serving Martin's DIP.

### Guard first

- **What must hold:** Conditions sit at one level, never one inside another, and each condition that ends the work returns at once, before the work.
- **Cases served:** Checks conditions before its work.
- **Source:** Fowler's guard-clause refactoring, made the required shape.

### One reason per module

- **What must hold:** A module holds exactly the code that changes for one reason.
- **Cases served:** Puts code in a file or folder; Reuses behaviour from another unit or type.
- **Source:** This is Martin's Single Responsibility Principle: one reason to change.

Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it. DRY is held here: "dry is true but it must be held with reasons to change not "same functional code right now"".

## No hidden effects

No rule. The principle decides. State that changes between calls lives only in an adapter: No hidden effects plus External behaviour sits at a boundary give it, so it is a case.

## External behaviour sits at a boundary

Outside dependency: what was called a package. An internal package is our own code, under One reason per module and the layering.

### Outside dependencies stay at boundaries

- **What must hold:** Production code uses an outside dependency only inside a recorded boundary, and no type from an outside dependency or a runtime library appears in business logic.
- **Cases served:** Uses a system or service outside the program; Takes an outside dependency.
- **Source:** Freeman and Pryce wrap outside types thinly; this rule does so for every outside dependency.

### Ports declared inside

- **What must hold:** Business logic declares every port it is handed and names it for the capability it needs, never for the mechanism behind it.
- **Cases served:** Uses a system or service outside the program; Causes an effect (writes, logs, sends, exits).
- **Source:** Martin's DIP: the abstraction belongs to the side that uses it.

The clock, random values, new ids and outside ordering are a case: the principle plus Ports declared inside give it. An outside dependency is not wrapped: it is used inside the boundary that needs it.

## No leak across a boundary

No rule. The principle, now covering data and failures, plus One reason per module, gives one adapter per outside party that maps both ways, so both Reads data from outside (request, file, environment, stored row, response) and Sends data out of the program owe it. Each is a case.

## The type checker proves it

### Failures are values

- **What must hold:** Between units of ours, every way an operation can fail is a named variant in its return type, and no failure is returned as a success, a default or an empty value.
- **Cases served:** An operation can fail.
- **Source:** Wlaschin's expected failures as values; Clean Code teaches exceptions instead.

### Declared, not asserted

- **What must hold:** A value's type comes only from a declaration of our own, never derived from an implementation, or from a parse at a boundary; no code of ours claims a type the checker does not verify.
- **Cases served:** Gives a value its type (declares it, or needs it narrower).
- **Source:** King's parse, don't validate.

### Kinds are named

- **What must hold:** A value of several kinds or states is a closed set of named kinds of our own, and wherever code chooses by kind, the checker proves every kind is chosen.
- **Cases served:** A value is one of several kinds or states.
- **Source:** Minsky's named variants.

"Of ours" matters in Declared, not asserted: a test framework's assertion that narrows a value is not a claim of ours. The strictest checker setting is a case; the principle gives it.

## Our code reads in the common language

### One word everywhere

- **What must hold:** Every value, unit, field and module is named with the domain's one word for what it is, spelt the same everywhere and at every scope; no meaning rests on position, and our code carries no prose, not even prose that repeats the code.
- **Cases served:** Names something; Explains something in prose.
- **Source:** Evans's ubiquitous language, across the whole codebase.

One word everywhere keeps "no meaning rests on position". A unit whose signature is ours takes one argument; a callback shaped by an outside API takes what that API passes.

Casing is a check under this rule. Writing basic logic in the language's own constructs is a case; the principle gives it.

## Outside risk is carried on purpose

### Outside dependencies justified

- **What must hold:** Every direct dependency, tools included, has a record that names the native way it was weighed against and why that way was not enough.
- **Cases served:** Takes an outside dependency.
- **Source:** Ours: a written reason for every outside dependency.

### Fixed versions

- **What must hold:** Every version we run is fixed exactly in the repository, by a pin or a lock file.
- **Cases served:** Takes an outside dependency.
- **Source:** OpenSSF Scorecard pins dependencies against supply-chain compromise.

### Tools live in the repo

- **What must hold:** Every tool we run is a dependency of the repository; none is fetched when it runs.
- **Cases served:** Takes an outside dependency.
- **Source:** Twelve-Factor: no reliance on system-wide tools.

### Upstream stays untouched

- **What must hold:** Vendored outside code is never edited; our change sits in an extension of ours outside it.
- **Cases served:** Takes an outside dependency.
- **Source:** Martin's Open-Closed Principle, applied to code we do not own.

### Shipped risk declared

Proposed, not accepted.

- **Proposed wording:** "Every outside dependency we ship is declared to whoever runs it, never hidden inside our build."
- **Case it would serve:** [Ships code for others](cases.md#proposed-cases) (proposed): what we ship is visible to an adopter's scanner.
- **Source:** The NTIA SBOM: a formal record of what we ship.
