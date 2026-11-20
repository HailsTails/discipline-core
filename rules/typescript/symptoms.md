# Symptoms in TypeScript

A symptom is something seen in code. It is suspect by default, and it may point at several rules. Symptoms here name TypeScript constructs. "Clearly a symptom can exist with ambiguity about reasoning."

A finding has two addresses: where the symptom is seen, and where the breach sits. A symptom's id is its name, hyphenated.

Where the thing seen is correct use, a [record](../records.md) covers it. The record kind is named under "Breach usually sits". No symptom carries an exception.

**May indicate** lists cases, then the rules they point at, as case → rule.

**Seen by** is one of:
- **syntax:** the file's tree alone;
- **types:** needs the type checker;
- **graph:** needs the import graph;
- **app:** needs the app's structure;
- **files:** config, file names or build output;
- **history:** needs the change history;
- **person:** only a person sees it.

**Check today** is how near today's checks come, from the [checks page](checks.md): reuse, partial, review (only a review clause covers it), new (nothing covers it), or only review (a person sees it).

Outside dependency: what was called a package. An internal package is our own code.

## The outside world reached directly

### Date used directly

- **Seen:** Any use of `Date` (`Date.now()`, `new Date()`, `new Date(value)`, `Date.parse`) or `performance.now()` outside the places that handle dates.
- **May indicate:** Needs the current time, a random value, a new id or an outside ordering → Ports declared inside; Written-out answers. Does one job → Doer or orchestrator ("Dating and numbering an order is not the same job as charging it").
- **Breach usually sits:** In the unit that should be passed the time; often a doer doing two jobs. Correct use: boundary record on the clock adapter.
- **Seen by:** syntax.
- **Check today:** reuse.

### Ambient randomness

- **Seen:** `Math.random()`, `crypto.randomUUID()` or `crypto.getRandomValues()` outside their adapter.
- **May indicate:** Needs the current time, a random value, a new id or an outside ordering → Ports declared inside; Written-out answers.
- **Breach usually sits:** In the unit that should be passed the value. Correct use: boundary record.
- **Seen by:** syntax.
- **Check today:** new.

### Process global used in place

- **Seen:** `process.env`, `process.argv`, `process.exit`, `process.on`, `console.*` or `globalThis` read outside an adapter.
- **May indicate:** Reads data from outside (request, file, environment, stored row, response) → No leak; Causes an effect (writes, logs, sends, exits) → Ports declared inside; Builds the real implementations → Ports declared inside.
- **Breach usually sits:** A missing port; or an adapter not built at the entry point. "Process env reader is just an external world being wrapped." Correct use: boundary record.
- **Seen by:** syntax.
- **Check today:** review.

### Outside import past a boundary

- **Seen:** An import, `import()` or `require` of an outside dependency or runtime module (`node:*`) in a file with no boundary record.
- **May indicate:** Uses a system or service outside the program → Outside dependencies stay at boundaries; Ports declared inside; Takes an outside dependency → Outside dependencies stay at boundaries.
- **Breach usually sits:** A missing adapter and port. Correct use: boundary record.
- **Seen by:** graph.
- **Check today:** partial.

### Outside type in a signature

- **Seen:** A type from an outside dependency or runtime library in a business-logic parameter, field or return, imported or inferred.
- **May indicate:** Uses a system or service outside the program → Outside dependencies stay at boundaries; No leak.
- **Breach usually sits:** The adapter that hands the outside type inward.
- **Seen by:** types.
- **Check today:** new.

### Library class built in place

- **Seen:** `new` on a class from an outside dependency, outside that dependency's adapter.
- **May indicate:** Takes an outside dependency → Outside dependencies stay at boundaries; Keeps state or settings across calls → No hidden effects.
- **Breach usually sits:** A missing adapter. Correct use: boundary record.
- **Seen by:** types.
- **Check today:** review.

## Text and schemas past their reader

"Json use and Zod use both imply same sort of symptom". They are two symptoms because two different things are seen.

### Text past its reader

- **Seen:** `JSON.parse`, `JSON.stringify` or a YAML parse or dump outside the adapter for whoever produced or receives the text, tests included.
- **May indicate:** Reads data from outside (request, file, environment, stored row, response), Sends data out of the program → No leak; Uses a system or service outside the program → External behaviour sits at a boundary. In a test: States what the unit gives back, for one case or several → Straight-through tests.
- **Breach usually sits:** A port that takes or gives text where it should carry objects: "a boundary on whoever made json". Correct use: in the producer's adapter, a boundary record; at one test site, an authorised location for this symptom alone.
- **Seen by:** syntax; types to trace the port.
- **Check today:** partial (tests only).

### Schema past its adapter

- **Seen:** A schema, a `.parse` call or a `z.infer` type outside the producer's adapter, or the same value parsed twice.
- **May indicate:** Reads data from outside (request, file, environment, stored row, response) → No leak; Gives a value its type (declares it, or needs it narrower) → Declared, not asserted.
- **Breach usually sits:** The adapter, which hands the wire type inward instead of mapping it. Correct use: a boundary record with a Conformist statement, for an outside model adopted as ours.
- **Seen by:** graph.
- **Check today:** review.

## Claimed or loose types

### Claimed type

- **Seen:** `as T` other than `as const`, `<T>x`, `x!` or `x!:`, including `as unknown` and any cast whose type holds `any`.
- **May indicate:** Gives a value its type (declares it, or needs it narrower) → Declared, not asserted. In a test: Checks a value that may be one of several outcomes → Straight-through tests; Gives a value its type (declares it, or needs it narrower): a cast to build an input → Handed what it uses.
- **Breach usually sits:** The declaration: an input too wide, a generic not bounded, a missing parse. "this feels like its hiding a problem with out modelling". Correct use: authorised location in the adapter whose outside contract forces it.
- **Seen by:** syntax.
- **Check today:** reuse.

### Untyped value

- **Seen:** `any` in a type position, or a `let` with no type and no initial value.
- **May indicate:** Gives a value its type (declares it, or needs it narrower) → Declared, not asserted; Reads data from outside (request, file, environment, stored row, response) → No leak.
- **Breach usually sits:** The boundary that let an unknown shape in. Correct use: debt.
- **Seen by:** syntax.
- **Check today:** reuse.

### Own type guard

- **Seen:** A function of ours whose return type is `x is T` or `asserts x is T`.
- **May indicate:** Gives a value its type (declares it, or needs it narrower) → Declared, not asserted; Reads data from outside (request, file, environment, stored row, response) → No leak.
- **Breach usually sits:** A missing schema parse at the adapter, or a declaration too wide.
- **Seen by:** syntax.
- **Check today:** new.

### Type derived from code

- **Seen:** `ReturnType<typeof x>`, `Parameters<typeof x>` or `typeof x` used as a type of our own.
- **May indicate:** Gives a value its type (declares it, or needs it narrower) → Declared, not asserted; Names something → One word everywhere.
- **Breach usually sits:** The producer, which has no named type.
- **Seen by:** syntax.
- **Check today:** reuse.

### Strictness weakened

- **Seen:** A project whose resolved compiler options leave a strict flag off.
- **May indicate:** Sets how strictly the checker works → The type checker proves it.
- **Breach usually sits:** The base config or the project that overrides it.
- **Seen by:** files.
- **Check today:** reuse.

### Default on a closed union

- **Seen:** `default:` in a `switch` over a closed union.
- **May indicate:** A value is one of several kinds or states → Kinds are named.
- **Breach usually sits:** The switch.
- **Seen by:** types.
- **Check today:** reuse.

### Boolean in a signature

- **Seen:** A `boolean` parameter, field, or return that stands for a mode or state.
- **May indicate:** A value is one of several kinds or states → Kinds are named; Does one job → Doer or orchestrator ("boolean inputs are a smell, disallowed").
- **Breach usually sits:** A missing named kind, or a unit with two modes.
- **Seen by:** syntax; types to tell a predicate.
- **Check today:** reuse.

### Absence standing for a state

- **Seen:** A field typed `T | null` or `T | undefined`, or optional, whose absence means a state rather than "not given".
- **May indicate:** A value is one of several kinds or states → Kinds are named; Keeps state or settings across calls → No hidden effects. "this is a bunch of nullable and state management mess".
- **Breach usually sits:** The type, which needs named kinds.
- **Seen by:** person; types to find candidates.
- **Check today:** only review.

### Default for a required value

- **Seen:** `??`, `||` or a parameter default that supplies a required config, context or environment value.
- **May indicate:** Reads data from outside (request, file, environment, stored row, response) → No leak ("no default, must be provided as env var"); An operation can fail → Failures are values; Gives a value its type (declares it, or needs it narrower) → Declared, not asserted.
- **Breach usually sits:** The declaration or the adapter: a missing value is a failure.
- **Seen by:** types.
- **Check today:** review.

## Failures

### Throw between our units

- **Seen:** `throw` outside an adapter whose caller's contract is exceptions.
- **May indicate:** An operation can fail → Failures are values; Sends data out of the program → No leak.
- **Breach usually sits:** The unit, or a missing mapping at the adapter. Correct use: authorised location. "Throwing in specific places allowed is just authorised locations as prose."
- **Seen by:** syntax; graph for adapters.
- **Check today:** review.

### Thrown non-error

- **Seen:** `throw` of a literal, an object or a template.
- **May indicate:** Sends data out of the program → No leak, since a thrown value speaks the caller's language.
- **Breach usually sits:** The throw site.
- **Seen by:** syntax.
- **Check today:** reuse.

### Failure shaped as success

- **Seen:** A failed path that returns `null`, `false`, `[]`, `undefined` or a default, or a `catch` that returns one.
- **May indicate:** An operation can fail → Failures are values.
- **Breach usually sits:** The unit's return type.
- **Seen by:** person; syntax for a `catch` that returns.
- **Check today:** only review.

### Catch-all failure kind

- **Seen:** A failure variant such as `unknown`, `other` or a bare message string, carrying no named cause.
- **May indicate:** An operation can fail → Failures are values; A value is one of several kinds or states → Kinds are named.
- **Breach usually sits:** The adapter, which did not name the outside failure.
- **Seen by:** types; person.
- **Check today:** new.

## Effects and state

### Loop keyword

- **Seen:** `for`, `for…of`, `for…in`, `for await`, `while` or `do`.
- **May indicate:** Makes a new value from what it has → No hidden effects; Causes an effect (writes, logs, sends, exits) → Ports declared inside; Coordinates other units → Doer or orchestrator. "For of mutates by its nature."
- **Breach usually sits:** The unit. Correct use: draining a stream in its source's adapter, as an authorised location.
- **Seen by:** syntax.
- **Check today:** reuse.

### Write into a parameter

- **Seen:** Assigning to or deleting a parameter's field, or calling an in-place method (`push`, `sort`, `splice`) on a parameter.
- **May indicate:** Makes a new value from what it has → No hidden effects.
- **Breach usually sits:** The unit.
- **Seen by:** syntax; types for in-place methods.
- **Check today:** reuse.

### Rebinding

- **Seen:** A `let` assigned again, or a parameter reassigned, incremented or destructured into.
- **May indicate:** Makes a new value from what it has → No hidden effects; Does one job → Doer or orchestrator (work done inline in steps).
- **Breach usually sits:** The unit. No caller sees it, so on its own it shows no hidden effect; it is suspect for inline work.
- **Seen by:** syntax.
- **Check today:** reuse.

### Authored class or this

- **Seen:** The `class` keyword in our code, `static`-only classes included, or `this` read outside a class.
- **May indicate:** Keeps state or settings across calls → No hidden effects; Reuses behaviour from another unit or type → One reason per module; Gives a value its type (declares it, or needs it narrower) → Declared, not asserted.
- **Breach usually sits:** The unit.
- **Seen by:** syntax.
- **Check today:** reuse.

### Module-level state

- **Seen:** A module-scope `let`, or a module-scope collection that functions change.
- **May indicate:** Keeps state or settings across calls → No hidden effects; External behaviour sits at a boundary.
- **Breach usually sits:** A missing adapter for the state.
- **Seen by:** syntax.
- **Check today:** new.

## Unit shape

### Long function

- **Seen:** A function body over the line limit.
- **May indicate:** Coordinates other units, Does one job → Doer or orchestrator; Gives a value its type (declares it, or needs it narrower) → Handed what it uses; Checks conditions before its work → Guard first; Puts code in a file or folder → One reason per module; Names something → One word everywhere. "Line and complexity are symptoms that flag many things. Functions doing too many things. Minimal interfaces issues. Nested logic indicating complexity density instead of isolated rules and responsibilities named for what they are."
- **Breach usually sits:** The unit: several jobs, an input wider than its use, nested questions, or a responsibility not isolated and named.
- **Seen by:** syntax.
- **Check today:** reuse.

### Tangled function

- **Seen:** A function over the cognitive-complexity limit.
- **May indicate:** The same cases and rules as Long function.
- **Breach usually sits:** As Long function.
- **Seen by:** syntax.
- **Check today:** reuse.

### Work inside a condition

- **Seen:** An `if` inside another `if`, or an `else` after a branch that always exits.
- **May indicate:** Checks conditions before its work → Guard first; Does one job → Doer or orchestrator. "If nested it's a poorly modelled set of questions for a single job."
- **Breach usually sits:** The unit's questions.
- **Seen by:** syntax.
- **Check today:** partial.

### Orchestrator that computes

- **Seen:** A function that calls two or more units of ours and also branches, computes or reshapes between the calls.
- **May indicate:** Coordinates other units → Doer or orchestrator.
- **Breach usually sits:** The orchestrator.
- **Seen by:** graph.
- **Check today:** review.

### Doer calling our own unit

- **Seen:** A function with logic that imports and calls a business-logic unit of ours that is not a port.
- **May indicate:** Does one job → Doer or orchestrator; Uses what a collaborator gives back → Written-out answers.
- **Breach usually sits:** The unit, mixing two roles.
- **Seen by:** graph.
- **Check today:** new.

### Positional parameters

- **Seen:** A function of ours, whose shape no outside API fixes, that has two or more parameters. "Functions with no outside influence should take 1. 2 is debatable. But for agents the goal is always 1."
- **May indicate:** Names something → One word everywhere; Does one job → Handed what it uses.
- **Breach usually sits:** The signature.
- **Seen by:** syntax.
- **Check today:** partial.

### Tuple as data

- **Seen:** An array literal or type of fixed mixed positions used as a value, such as `[key, value]` pairs or `pair[1]`.
- **May indicate:** Names something → One word everywhere ("nope, you will not use tupple like arrays for data").
- **Breach usually sits:** The data's type.
- **Seen by:** syntax; types.
- **Check today:** new.

### Wide input

- **Seen:** A parameter type holding fields the unit never reads.
- **May indicate:** Does one job, Gives a value its type (declares it, or needs it narrower) → Handed what it uses.
- **Breach usually sits:** The unit's declared input.
- **Seen by:** types.
- **Check today:** new.

### Wide port

- **Seen:** A port with methods its consumer never calls.
- **May indicate:** Uses a system or service outside the program → Handed what it uses; Ports declared inside.
- **Breach usually sits:** The port.
- **Seen by:** graph; types.
- **Check today:** new.

## Layers and wiring

### Inner layer imports outer

- **Seen:** A domain or business-logic file that imports an adapter or infrastructure file.
- **May indicate:** Uses a system or service outside the program → Ports declared inside; Outside dependencies stay at boundaries; External behaviour sits at a boundary.
- **Breach usually sits:** The import, or a port declared on the wrong side.
- **Seen by:** app.
- **Check today:** review.

### Port outside the domain

- **Seen:** A port interface declared in an adapter's module, or beside its default adapter.
- **May indicate:** Uses a system or service outside the program → Ports declared inside ("the port is domain and to be kept separate to the concrete implementation or use").
- **Breach usually sits:** The port's file.
- **Seen by:** graph.
- **Check today:** review.

### Adapter built outside the root

- **Seen:** A call to an adapter's factory anywhere but the entry point.
- **May indicate:** Builds the real implementations → Ports declared inside; Doer or orchestrator.
- **Breach usually sits:** The calling unit, which builds what it should be passed.
- **Seen by:** graph.
- **Check today:** review.

### Port named for a mechanism

- **Seen:** A port named for a technology (`HttpClient`, `Fs`, `Sqlite`) rather than a capability.
- **May indicate:** Uses a system or service outside the program → Ports declared inside; Names something → One word everywhere.
- **Breach usually sits:** The port.
- **Seen by:** person.
- **Check today:** only review.

## Tests

### Double with a body

- **Seen:** A double that has a function body at all: `vi.fn(impl)`, `mockImplementation`, or a hand-written function or object double. A body that only returns a value is included. "Exact returns can use mockreturn or mockresolve".
- **May indicate:** Uses what a collaborator gives back → Written-out answers; Does one job: the port the stub stands in for → Handed what it uses; Does one job: the collaborator the stub stands in for → Doer or orchestrator. "The stub form not expressing has to be tied to something very strong to justify. Or it implies a different root cause around coupling to external behaviour".
- **Breach usually sits:** A port too wide, or a collaborator holding two decisions. Correct use: deviation from [Stub with vi.fn](recipes.md#stub-with-vifn).
- **Seen by:** syntax.
- **Check today:** reuse.

### Module or global patched

- **Seen:** `vi.mock`, `vi.stubGlobal`, a spy on a global, or `process.env` set in a test.
- **May indicate:** Uses what a collaborator gives back → Written-out answers; Uses a system or service outside the program: a global or the environment patched → Ports declared inside. "if you are doing this you have severely messed up your dependency management".
- **Breach usually sits:** The unit, which imports what it should be passed.
- **Seen by:** syntax.
- **Check today:** partial.

### Branch in a test

- **Seen:** `if`, a ternary, `&&`, `||`, `??`, `?.` or `switch` in a test file.
- **May indicate:** Checks a value that may be one of several outcomes → Straight-through tests; A value is one of several kinds or states: the unit's output → Kinds are named; An operation can fail: the unit's output → Failures are values.
- **Breach usually sits:** Often the unit's output type: optional or loose shapes force the test to branch.
- **Seen by:** syntax.
- **Check today:** reuse.

### Computed value in a test

- **Seen:** A test that builds or picks a value: array methods, `find`, `Math.*`, `Object.assign`, `Object.fromEntries`, `Array.from` or a spread over a list. Calls on the unit's own API are not included.
- **May indicate:** States what the unit gives back, for one case or several → Straight-through tests; Uses what a collaborator gives back → Written-out answers. "Math and map are deterministic logic. Banned in tests."
- **Breach usually sits:** The test, or logic no unit owns.
- **Seen by:** syntax.
- **Check today:** reuse.

### Throw or catch in a test

- **Seen:** `throw`, `try` or `catch` in a test file.
- **May indicate:** States what the unit gives back, for one case or several → Straight-through tests; An operation can fail → Failures are values.
- **Breach usually sits:** Often the unit, which throws.
- **Seen by:** syntax.
- **Check today:** reuse.

### Unasserted call

- **Seen:** A stub or spy passed to the unit whose calls the test never asserts.
- **May indicate:** Uses what a collaborator gives back → Written-out answers ("If the unit calls something we check it calls it.").
- **Breach usually sits:** The test.
- **Seen by:** syntax; types.
- **Check today:** new.

### Answer set in a hook

- **Seen:** A test hook that gives a stub its answer (`mockReturnValue`, `mockResolvedValue`, `mockImplementation`) or reassigns a value the tests read. A plain reset in `afterEach` is not this symptom. "Nothing wrong with a reset in after each. But something wrong with a remock in after each. Implies the suite knows the input needed for each test." Sharing alone is not the breach: "I have no issue with shared boilerplate or even mock builders when it doesn't hide minimal interfaces issues and doesn't hide assumptions or coupling between tests. But it often does when not done with care."
- **May indicate:** States what the unit gives back, for one case or several → Straight-through tests (each test is one complete, distinct case); Uses what a collaborator gives back → Written-out answers; Keeps state or settings across calls → No hidden effects.
- **Breach usually sits:** A double or a value shared across tests at file or suite scope; or state held in the unit's module.
- **Seen by:** syntax.
- **Check today:** partial (the `let` form only).

### Test switched off

- **Seen:** `.only`, `.skip`, `fit` or `xit`.
- **May indicate:** Gives each unit its test → Tested where it's owned.
- **Breach usually sits:** The test file.
- **Seen by:** syntax.
- **Check today:** reuse.

### Unit without a running test

- **Seen:** A file with a runtime export and no `name.test.ts` beside it that imports and runs it.
- **May indicate:** Gives each unit its test → Tested where it's owned.
- **Breach usually sits:** The missing test. Correct use: debt.
- **Seen by:** files; graph.
- **Check today:** reuse.

### Machine touched in a unit test

- **Seen:** A unit test that reads or writes files, spawns a process, opens a socket or makes a temp directory.
- **May indicate:** Tests across units or against a real system → Tested where it's owned; Uses what a collaborator gives back → Written-out answers. "even TMP directory style ones should not need to exercise real operations of any kind".
- **Breach usually sits:** The unit, which has no port; or a test that is an integration test misnamed.
- **Seen by:** syntax; files.
- **Check today:** new.

### Inherited environment in a subprocess

- **Seen:** A process spawned in a test with no explicit environment, or one built from `process.env`.
- **May indicate:** Tests across units or against a real system → Tested where it's owned (Tests are ours).
- **Breach usually sits:** The spawn site.
- **Seen by:** syntax; types.
- **Check today:** partial.

### Behaviour tested away from its owner

- **Seen:** A unit test that asserts what a collaborator does, or an integration test that pins a rule a unit owns.
- **May indicate:** Tests across units or against a real system, Gives each unit its test → Tested where it's owned; Uses what a collaborator gives back → Written-out answers.
- **Breach usually sits:** The test level.
- **Seen by:** person; graph.
- **Check today:** only review.

### Integration-heavy suite

- **Seen:** More integration tests, or more integration test cases, than the bindings to the outside they cover.
- **May indicate:** Tests across units or against a real system → Tested where it's owned. "We had excessive integration tests and "fixtures" for what we're unit level business rules."
- **Breach usually sits:** Missing unit tests and ports.
- **Seen by:** files (by the integration test suffix).
- **Check today:** review.

### Coverage gate

- **Seen:** A coverage percentage threshold in test config.
- **May indicate:** Gives each unit its test → Tested where it's owned.
- **Breach usually sits:** The config.
- **Seen by:** files.
- **Check today:** review.

### Large input for a few fields

- **Seen:** A test that writes a large object, or casts, to give the unit the few fields it reads.
- **May indicate:** Gives a value its type (declares it, or needs it narrower), Does one job → Handed what it uses. "Shows up in tests where to avoid writing a large object for 2 fields that impact th test they double cast."
- **Breach usually sits:** The unit's declared input.
- **Seen by:** person; syntax for the cast.
- **Check today:** only review.

### Test of the type checker

- **Seen:** A test that asserts only what the types already prove, such as exhaustiveness.
- **May indicate:** Gives each unit its test → Tested where it's owned. "it simply checks the type system itself. Instead of adding value."
- **Breach usually sits:** The test.
- **Seen by:** person.
- **Check today:** only review.

## Names, prose and files

### Shorthand name

- **Seen:** A name of single letters, an abbreviation or a filler word (`data`, `result`, `options`, `tx`), at any scope.
- **May indicate:** Names something → One word everywhere.
- **Breach usually sits:** The name. Correct use: authorised location for a name an outside contract fixes.
- **Seen by:** syntax.
- **Check today:** reuse.

### Name off its casing

- **Seen:** An identifier or file name outside the adopter's casing convention.
- **May indicate:** Names something → One word everywhere.
- **Breach usually sits:** The name. Correct use: authorised location for an outside contract's names (`PATH`, ESLint listener keys).
- **Seen by:** syntax; files.
- **Check today:** reuse.

### Drawer path

- **Seen:** A file or folder named utils, helpers, types, common, shared or the like.
- **May indicate:** Puts code in a file or folder → One reason per module. "this folder is a junk drawer".
- **Breach usually sits:** The module's contents.
- **Seen by:** files.
- **Check today:** reuse.

### Types-only file

- **Seen:** A file that declares only types and is not a port declaration.
- **May indicate:** Puts code in a file or folder, Reuses behaviour from another unit or type → One reason per module ("There shouldn't be type only files. They should be entities.").
- **Breach usually sits:** The entity's module.
- **Seen by:** syntax.
- **Check today:** new.

### Prose in code

- **Seen:** Any comment or JSDoc other than a tracked pointer or a covered tool directive.
- **May indicate:** Explains something in prose → One word everywhere.
- **Breach usually sits:** A name or type that does not carry the meaning.
- **Seen by:** syntax.
- **Check today:** new.

### Untracked escape

- **Seen:** A TODO, linter directive or `@ts-*` directive with no tracked reference and no record.
- **May indicate:** Explains something in prose → One word everywhere; whatever rule the directive switches off.
- **Breach usually sits:** The record that is missing.
- **Seen by:** syntax.
- **Check today:** reuse.

### Many spellings of one concept

- **Seen:** One domain concept named two or more ways across the code or the wire.
- **May indicate:** Names something → One word everywhere ("I don't want to propogate 3 duplicates").
- **Breach usually sits:** The vocabulary.
- **Seen by:** person; the vocabulary list makes it checkable.
- **Check today:** new.

### Outside dependency vocabulary for basic logic

- **Seen:** An import of a utility or functional outside dependency (lodash, fp-ts) for branching, matching, transforming or results.
- **May indicate:** Writes basic logic (branching, matching, transforming, results) → Our code reads in the common language; Takes an outside dependency → Outside dependencies justified.
- **Breach usually sits:** The dependency.
- **Seen by:** graph.
- **Check today:** new.

### Duplicate decision

- **Seen:** The same decision written in two or more places.
- **May indicate:** Reuses behaviour from another unit or type, Puts code in a file or folder → One reason per module. "dry is true but it must be held with reasons to change not "same functional code right now"".
- **Breach usually sits:** Where the decision's home should be. A clone only surfaces a candidate.
- **Seen by:** person; clone tools surface candidates.
- **Check today:** only review.

### Change spread across modules

- **Seen:** One change for one reason touches many modules, or two modules always change together.
- **May indicate:** Puts code in a file or folder → One reason per module. "Cause 2 things that change together is potentially a sign of reasons to change boundaries are incorrect."
- **Breach usually sits:** The module boundaries.
- **Seen by:** history.
- **Check today:** new.

## Dependencies and versions

### Floating version

- **Seen:** A range (`^`, `~`, `*`, `x`) or a tag (`latest`, `lts`) for an outside dependency, a runtime or a CI action.
- **May indicate:** Takes an outside dependency → Fixed versions.
- **Breach usually sits:** The manifest or workflow.
- **Seen by:** files.
- **Check today:** new.

### No lock file

- **Seen:** A repository with dependencies and no committed lock file.
- **May indicate:** Takes an outside dependency → Fixed versions.
- **Breach usually sits:** The repository.
- **Seen by:** files.
- **Check today:** new.

### Dependency without a record

- **Seen:** A direct dependency, tools included, with no record of the native way weighed.
- **May indicate:** Takes an outside dependency → Outside dependencies justified.
- **Breach usually sits:** The record.
- **Seen by:** files.
- **Check today:** new.

### Tool fetched at run time

- **Seen:** `npx`, `dlx`, `bunx` or a download-and-run in a script, CI step or doc.
- **May indicate:** Takes an outside dependency → Tools live in the repo.
- **Breach usually sits:** The script.
- **Seen by:** files.
- **Check today:** new.

### Edit inside vendored code

- **Seen:** A change to a file inside a vendored folder.
- **May indicate:** Takes an outside dependency → Upstream stays untouched.
- **Breach usually sits:** The change. Correct use: an authorised location (drift).
- **Seen by:** history.
- **Check today:** new.

### Bundled dependency

- **Seen:** Published build output that holds a dependency's code that the package manifest does not declare.
- **May indicate:** Ships code for others (proposed) → Shipped risk declared (proposed, not accepted). "Do we still bundle Zod which means a Zod cve won't show up accurately?"
- **Breach usually sits:** The build config.
- **Seen by:** files (build output).
- **Check today:** new.
