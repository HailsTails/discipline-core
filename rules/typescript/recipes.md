# Recipes for TypeScript

A recipe is a known method that makes a [rule](../rules.md) hold, with the reason it was chosen. Recipes name the tool, the feature and the method. Rules stay as they are.

A recipe is "as binding as it's reasoning. The proof of burden is on the deviation to show that the reason it was chosen no longer holds."

So every recipe says why it was chosen, and binds as far as that reason holds. **A [deviation record](../records.md#deviation) names the recipe and its reason, and shows that this reason does not hold at this site. Showing that another method also meets the rule is not enough.**

Where a reason is marked **proposed**, it is not yet accepted.

Outside dependency: what was called a package. An internal package is our own code.

## Tests are ours

### Written-out answers

#### Stub with vi.fn

- **Method:** Each collaborator is a `vi.fn()` declared as a const inside the test that uses it. Shared boilerplate or a mock builder is allowed where it hides none of three things: a wide interface, an assumption a test rests on, or coupling between tests. A shared double is therefore a symptom, suspect by default, not a breach. Its answer is `mockReturnValue` or `mockResolvedValue` with a written-out value. Each call is checked with `toHaveBeenCalledWith` and a written-out argument.
- **Chosen because:** "these should be vi.fn, with mockResolvedValue, not custom async functions"; "Agents take fake to mean whatever they want it to mean right now." The framework's double has no body of ours to hold logic.
- **You can tell because:** No double has a body, a branch or a table. Every call the unit makes is asserted.
- **Industry name:** stub and spy; Test Stub (Meszaros, *xUnit Test Patterns*).

A fake is not a recipe. It is a [deviation record](../records.md#deviation), and the bar it must meet is: "Moving a fake is only allowed if the test cannot be done with deterministic stubs or hardcoded things."

#### Ports in the argument

- **Method:** The unit takes its ports in its one argument object, or from the factory that built it. The test passes stubs the same way. No `vi.mock`, no global stub, no `process.env` set in a test.
- **Chosen because:** "If it calls something and uses its output we hardcode that output using DI."; "there should be absolutely no reason to be setting process env in a test, if you are doing this you have severely messed up your dependency management".
- **You can tell because:** The test imports only the unit and its types. Nothing is patched.
- **Industry name:** dependency injection; constructor injection (Fowler); Pure DI (Seemann).

### Straight-through tests

#### it.each over typed rows

- **Method:** Several cases of one behaviour are one `it.each<Row>([...])`. `Row` is a declared type. Each row writes out its input and its expected output.
- **Chosen because:** "It's just boilerplate for cases being tested."
- **You can tell because:** Every row is a literal. No row is built, mapped or picked.
- **Industry name:** Parameterized Test (Meszaros), with rows typed and written out.

#### Assert to narrow

- **Method:** A value that may be absent or one of several outcomes is narrowed with the framework's `assert` first. After that, plain `expect` reads it.
- **Chosen because:** "use vi assert to validate it's existence first to narrow the type to exclude the need for optional chain".
- **You can tell because:** No `?.`, `&&`, `if` or ternary in the test.
- **Industry name:** Guard Assertion (Meszaros).

#### Whole written-out expectation

- **Method:** Assert the whole returned value with `toEqual` against a written-out literal. Read list items by bare index after an assert, never with `find`.
- **Chosen because:** "no find, use bare access in tests for determinstic insistence on behaviours".
- **You can tell because:** The expected value is a literal in the test.
- **Industry name:** Literal Value (Meszaros).

#### Failure asserted as a value

- **Method:** A failure is checked as the returned variant: `expect(result).toEqual({ outcome: "failure", ... })`. An adapter whose caller's contract is a throw is checked with `expect(call).toThrow(...)`.
- **Chosen because (proposed):** "more error throwing, not allowed". A `try` or `catch` in a test is a branch that decides whether the test passes.
- **You can tell because:** No `try`, `catch` or `throw` in any test.
- **Industry name:** none; it follows from Failures are values.

### Tested where it's owned

#### Companion test file

- **Method:** `name.ts` has `name.test.ts` beside it. The test imports the unit and runs it.
- **Chosen because:** "if its a unit test it covers the unit it is the companion file to".
- **You can tell because:** Each file with a runtime export has a sibling that runs it.
- **Industry name:** the same convention as Go's `_test.go` files beside the package.

#### Integration test suffix

- **Method:** A test of a binding to the outside is named `name.integration.test.ts`. Every other test file is a unit test.
- **Chosen because:** "a useful pattern to ensure boundaries are clear when to maintain and keep pyramid checkable."
- **You can tell because:** The two kinds can be counted and checked by file name.
- **Industry name:** the same convention as Maven Failsafe's `*IT.java` integration tests.

#### Integration test owns its scratch

- **Method:** Only an integration test touches a real file or subprocess. It makes its own temporary directory, gives every subprocess an explicit environment, and removes the directory after. The environment comes from a unit of ours with its own test, not a test helper.
- **Chosen because (proposed):** An ambient setting broke the shared checkout three times; each fix to one instance left the class open.
- **You can tell because:** No unit test touches disk or spawns a process. No integration test reads `process.env` or inherits git settings.
- **Industry name:** Fresh Fixture (Meszaros).

## One place decides

### Doer or orchestrator

#### Composed orchestrator

- **Method:** An orchestrator's body is a sequence of named calls to our units. Each failed result returns at once, unchanged. Any computing or branching between calls moves into a named doer.
- **Chosen because:** "If it's long it's doing too many things inline. I hold to functions are doers or are orchestrator a teaching."
- **You can tell because:** The orchestrator holds calls, early returns of failures, and a final return.
- **Industry name:** the Integration Operation Segregation Principle (Westphal); Composed Method (Beck).

#### Functional iteration

- **Method:** Work over several values uses `map`, `filter`, `flatMap` or `reduce`, returning new values. No `for`, `for…of` or `while`. A stream is drained with `for await` only in its source's adapter, at an authorised location.
- **Chosen because:** "For of mutates by its nature. It doesn't return. It's state holding required or side effect based."
- **You can tell because:** No loop keyword outside a recorded drain. Nothing is pushed into an outer binding.
- **Industry name:** Collection Pipeline; Replace Loop with Pipeline (Fowler).

### Handed what it uses

#### One argument object

- **Method:** A function whose signature is ours to choose takes one argument: an object with named fields, whose declared type lists only the fields the unit reads. A function whose shape an outside API fixes (a callback to `map` or `reduce`) takes what that API passes. No tuple carries data.
- **Chosen because:** "Shows up in tests where to avoid writing a large object for 2 fields that impact th test they double cast. It shows the minimum interface principle."; "Functions with no outside influence should take 1. 2 is debatable. But for agents the goal is always 1."; "nope, you will not use tupple like arrays for data".
- **You can tell because:** No function of ours has two or more parameters unless an outside API fixes its shape. No test casts to build an input.
- **Industry name:** Introduce Parameter Object (Fowler), always one object.

#### Narrow ports

- **Method:** A port interface lists only the methods its one consumer calls. One adapter fulfils several narrow ports.
- **Chosen because:** "Rather than writing 6 different concrete things 1 for each."; "narrowed ports that still help us find the seams where the dependencies link up".
- **You can tell because:** Each port's methods are all called by its consumer.
- **Industry name:** role interface (Fowler); Interface Segregation.

#### Entity module

- **Method:** An entity's type and its logic share one module. Its functions take the entity.
- **Chosen because:** "The anaemic concern there is that by writing types with no logic you are failing coupling/cohesion and single responsibility principles."
- **You can tell because:** No file holds only types, except port declarations.
- **Industry name:** DDD entity (Evans).

Entity module also serves One reason per module.

### Guard first

#### Guard clauses

- **Method:** Each ending condition is `if (...) return ...;` at the top. There is no `else` after a return. The work is the last return.
- **Chosen because:** "If nested it's a poorly modelled set of questions for a single job."
- **You can tell because:** No `if` sits inside another `if`. There is no `else` after an exit.
- **Industry name:** Replace Nested Conditional with Guard Clauses (Fowler).

### One reason per module

#### Screaming folders

- **Method:** Folders and files are named for the domain capability they hold. None is called utils, helpers, types or common.
- **Chosen because:** "all types have a purpose. that purpose is its reason to exist and its reason to change"; screaming architecture "making those boundaries easier to see when broken".
- **You can tell because:** Each path names a domain concept.
- **Industry name:** Screaming Architecture (Martin); package by feature.

[Entity module](#entity-module) also serves this rule.

## No hidden effects

The principle decides.

### Copy, never write in

- **Method:** A changed value is a new one: `{ ...order, total }` or `[...items].sort()`. Nothing writes to, deletes from, or rebinds a parameter.
- **Chosen because:** "this is giving mutation of input args vibes, not okay"; "pure functions are required".
- **You can tell because:** No assignment to a parameter or its fields.
- **Industry name:** immutability; Value Object (Fowler); functional core.

### Closure factory

- **Method:** Settings and changing state live in a factory, `createX({ settings })`. It returns an object of functions that close over private bindings. We author no `class`. A library's class is built only in its adapter.
- **Chosen because:** "this is a bunch of nullable and state management mess". Proposed: Once a method travels as a value, its `this` is a fact the checker does not prove.
- **You can tell because:** No `class` keyword in our code. No unit reads `this`.
- **Industry name:** Private Members (Crockford).

[Functional iteration](#functional-iteration) also serves this principle.

## External behaviour sits at a boundary

### Outside dependencies stay at boundaries

#### Adapter per outside party

- **Method:** An outside dependency or runtime module is imported only in the adapter file for the party it reaches. That adapter fulfils a port and returns our types. Nothing re-exports the outside dependency. `JSON.parse` is called inside the adapter for whoever produced the JSON.
- **Chosen because:** "I didn't want a json parse wrapper. I wanted a boundary on whoever made json"; "Json parse has no contract… Http fetch library for example has complexity to bind".
- **You can tell because:** Each package import sits in a file with a boundary record.
- **Industry name:** Adapter; Gateway; anti-corruption layer; Hexagonal Architecture (Cockburn).

### Ports declared inside

#### Port in the domain

- **Method:** The port's interface is declared in the domain, in a module of its own, named for the capability. It sits apart from the adapter that fulfils it and from the unit that uses it; both import it from there. Storage is such a port, named for what the domain asks.
- **Chosen because:** "In clean architecture the port is domain and to be kept separate to the concrete implementation or use."; "then host facts source should be declared separately to its concrete implementation to protiect dependency inversion".
- **You can tell because:** No port is declared in an adapter's module or in its consumer's. No business-logic file imports an adapter. No query or driver type in business logic.
- **Industry name:** dependency inversion (Martin); Clean Architecture.

#### World values through a port

- **Method:** The current time, new ids, random values and process lifecycle each come from a port: `clock.now()`, `ids.next()`. A stub returns a written-out value.
- **Chosen because:** "date creates non determinism and leaks the world in"; "we have a uuid factory, you should not be importing dependencies".
- **You can tell because:** No `Date.now()`, `new Date()`, `randomUUID` or `process.exit` outside their adapters.
- **Industry name:** Volatile Dependencies (Seemann).

#### Composition root

- **Method:** One entry-point module builds every adapter and passes each one in.
- **Chosen because (proposed):** If a unit builds its own adapter, it imports it, so the port is not passed in and the test cannot stub it.
- **You can tell because:** No other module calls an adapter's factory.
- **Industry name:** Composition Root (Seemann).

## No leak across a boundary

The principle decides.

### Zod at the producer's adapter

- **Method:** The adapter for whoever produced the data parses it once with a Zod schema. The `z.infer` type is the wire type and stays in the adapter. The adapter maps it to a domain type of ours. A missing required value, environment included, is a failure, never a default.
- **Chosen because:** "my insistence on not writing complex logic to parse"; "Hand rolled is potentially a messy and lossy option?"; "Zod is the wire."
- **You can tell because:** No schema, `z.infer` type or text past the adapter. Each crossing is parsed once.
- **Industry name:** parse, don't validate (King).

### Map out at the adapter

- **Method:** Business logic hands the adapter our own value. Only the adapter turns it into the receiver's form (`JSON.stringify`, a status, a header).
- **Chosen because:** "As we should be runtime objects not json as soon as we leave a boundary".
- **You can tell because:** No outside form is built in business logic.
- **Industry name:** anticorruption layer (Evans).

### Failure mapping at the adapter

- **Method:** The adapter turns a library's throw into a failure variant of ours. At the program's edge, it turns our failure into the caller's form: an exit code, a status, or a throw where that caller's contract is exceptions.
- **Chosen because (proposed):** "They are about speaking the language of the caller at the boundary."
- **You can tell because:** No `throw` except at an adapter whose caller expects one.
- **Industry name:** anticorruption layer (Evans), applied to failures.

Failure mapping at the adapter also serves Failures are values.

## The type checker proves it

### Failures are values

#### Result union

- **Method:** One shared result type tagged `result`, carrying `value` or `error`. The error is a tagged union of our own with a `kind`, as plain data. A caller returns a failed result at once, unchanged; where it must choose by failure, it is a `switch` on `kind` with no `default`.
- **Chosen because:** "it makes the output clear to type system instead of hidden in throws".
- **You can tell because:** No `throw` between units of ours. No failure is returned as `null`, `false`, `[]` or a default.
- **Industry name:** Result type (Wlaschin).

[Failure mapping at the adapter](#failure-mapping-at-the-adapter) also serves this rule.

### Declared, not asserted

#### Named, exported type

- **Method:** Declare and export a named type. Annotate the factory and its return with it. Never `ReturnType<typeof x>`.
- **Chosen because (proposed):** A derived type couples the consumer to the producer's implementation, not its contract.
- **You can tell because:** Every type a unit returns has its own name.
- **Industry name:** none; ours.

#### Fix the declaration, not the value

- **Method:** When a cast seems needed, narrow the declared input to the fields used, or tighten the generic so the checker proves it. No `as`, no `!`, no type guard of ours.
- **Chosen because:** "the correct amount of casting is **0**"; "this feels like its hiding a problem with out modelling".
- **You can tell because:** Zero casts except `as const`.
- **Industry name:** none; ours.

#### Bounded context generic

- **Method:** A middleware that reads a context field takes a generic bounded so the field must exist. Each layer widens it.
- **Chosen because (proposed):** A field read from an open context is either cast or defaulted. Both hide a missing capability until run time.
- **You can tell because:** No middleware checks for, or defaults, a field it reads.
- **Industry name:** none; ours.

#### Shared strict base config

- **Method:** All strict flags sit in one base config that every `tsconfig.json` extends. No file turns one off.
- **Chosen because (proposed):** One place sets strictness, so no project weakens it unseen.
- **You can tell because:** The resolved config of every project has every flag on.
- **Industry name:** none; ours.

[Zod at the producer's adapter](#zod-at-the-producers-adapter) and [Assert to narrow](#assert-to-narrow) also serve this rule. The framework's assertion is not a claim of ours.

### Kinds are named

#### Tagged union and exhaustive switch

- **Method:** Kinds are a string-literal tag on a union. Choosing is a `switch` with one case per kind and no `default`, so the checker proves every kind is handled. A mode or state is a literal union (`"compact" | "full"`), never a `boolean`.
- **Chosen because:** "boolean inputs are a smell, disallowed"; "no boolean inputs, breaks clean code".
- **You can tell because:** No `default:` on a closed union. No boolean parameter or field stands for a state.
- **Industry name:** algebraic data type; exhaustiveness checking (TypeScript Handbook), with no `default` branch.

## Our code reads in the common language

### One word everywhere

#### Domain vocabulary list

- **Method:** One list of domain terms, one word per concept, read before naming. A new concept goes on the list before it is named in code.
- **Chosen because:** "to stop naming things 10 different ways for the same concept."
- **You can tell because:** One concept has one spelling across the code.
- **Industry name:** ubiquitous language (Evans).

#### Whole words

- **Method:** Every name is whole words, at every scope, lambdas included. No single letters, abbreviations or filler words such as data, result or options.
- **Chosen because:** "dont care if its a lambda function or not, meaningful names always"; "no, the problem is the lack of a whole word".
- **You can tell because:** No name is on the shorthand or filler list.
- **Industry name:** descriptive names (Google TypeScript Style Guide), at every scope.

#### Meaning in names, not comments

- **Method:** What a comment would say goes into a name, a type or a union. The only annotations are a tracked pointer such as `(#42)` and a tool directive covered by a record.
- **Chosen because:** "If the code isn't self explanatory that's the problem. You shouldn't need usage notes at all."
- **You can tell because:** No comment or JSDoc in our code.
- **Industry name:** none; ours. It is stricter than Martin's *Clean Code*, which keeps a section on good comments.

[One argument object](#one-argument-object) also serves this rule.

Casing is a check that runs the adopter's own lint. It is not a recipe. Basic logic in the language's own constructs is a case under the principle; its recipe is the native array and object methods, chosen because an outside dependency's language for them is "language obscuring standard operations".

## Outside risk is carried on purpose

### Outside dependencies justified

#### Dependency record

- **Method:** One [dependency record](../records.md#dependency-record) per direct dependency, tools included, names the native way weighed and why it fell short.
- **Chosen because:** "Packages need a justification for the maintenance they add."
- **You can tell because:** Every entry in `package.json` has a record.
- **Industry name:** architecture decision record (Nygard).

Proposed, not accepted: the case [An adopter is not handed our risk](../cases.md#proposed-cases), under Outside dependencies justified. A peer dependency is a direct dependency of ours, so it needs a record. The risk it weighs is carried by whoever runs it, the adopter included.

### Fixed versions

#### Exact pins and a lock file

- **Method:** Every version we run is exact: dev dependencies, tools, CI runtimes and actions carry no `^`, `~` or tag, and the lock file is committed. The range a published package offers its adopters is not a version we run.
- **Chosen because:** "dependencies must be pinned"; "If we ship with dependencies we need lock files."
- **You can tell because:** No range, and no tag such as `latest`.
- **Industry name:** Pinned-Dependencies (OpenSSF Scorecard).

### Tools live in the repo

#### Repo scripts only

- **Method:** Every tool is a dev dependency, run by a `package.json` script. Nothing runs through `npx`, `dlx` or a fetch at run time. A standard open-source tool wins over a custom script.
- **Chosen because:** "if this is common script it should be in package json, not run through tsx"; "I don't want a custom script, can you get something more standardised and provided by open source or something?"
- **You can tell because:** Every command in CI and the docs is a script name.
- **Industry name:** Twelve-Factor, Dependencies.

### Upstream stays untouched

#### Extension outside the vendored code

- **Method:** A change is made through the vendored code's extension points or config, in a folder of ours.
- **Chosen because:** "this must be justified as additional drift as impossible to apply as an extension instead".
- **You can tell because:** No diff inside the vendored folder. An edit there breaches Upstream stays untouched. It is held only by an [authorised location](../records.md#authorised-location) on Edit inside vendored code that names its case and when it should be dropped.
- **Industry name:** Open-Closed Principle (Martin).

### Shipped risk declared

Proposed, not accepted: the rule, its case [Ships code for others](../cases.md#proposed-cases), and this recipe.

#### Declared, not bundled

- **Method:** A published package bundles no dependency. Each one is a pinned `dependencies` entry or a `peerDependencies` declaration.
- **Chosen because:** "Do we still bundle Zod which means a Zod cve won't show up accurately?"; "Otherwise we ship as a peer dependency declaration only."
- **Industry name:** Twelve-Factor, Dependencies.

## Built-ins and libraries: decided answers

Whether code of ours may use a built-in or a library directly, as the principles decide it. Short names in the "By" column: Tests ([Tests are ours](../principles.md#tests-are-ours)), One place ([One place decides](../principles.md#one-place-decides)), Effects ([No hidden effects](../principles.md#no-hidden-effects)), Boundary ([External behaviour sits at a boundary](../principles.md#external-behaviour-sits-at-a-boundary)), Leak ([No leak across a boundary](../principles.md#no-leak-across-a-boundary)), Checker ([The type checker proves it](../principles.md#the-type-checker-proves-it)), Language ([Our code reads in the common language](../principles.md#our-code-reads-in-the-common-language)), Outside risk ([Outside risk is carried on purpose](../principles.md#outside-risk-is-carried-on-purpose)).

| Case | Answer | By |
|---|---|---|
| `console` | Only through a port passed in | Effects |
| `Date.now()` in `chargeOrder` | No: it depends on more than its arguments, and dating is another unit's decision | Boundary, One place, Tests |
| An HTTP client, or our own wrapper of one, imported | No: a port passed in | Boundary |
| `Intl.NumberFormat` | No: depends on the runtime's locale data | Boundary |
| `structuredClone`, `Math`, `Map`, `URL` | Direct in business logic; never to compute a test's expectation | Boundary, Tests |
| `JSON.parse`, `isValidIBAN` | Direct, no wrapper, in the adapter | Leak |
| `z.infer` as a business-logic type | No: not our own type, and an outside dependency's type in a signature | Leak, Boundary, Language |
| `addBusinessDays` from a library | No: the decision is not made by a unit of ours | One place |
| `decimal.js` for integer cents | No: the record cannot say why native was not enough | Outside risk |
| `neverthrow`, `ts-pattern`, `fp-ts`, `type-fest` | No | Language, Outside risk |
| lodash | No | named ban |

Quoted reasons: "json and Zod indicate a boundary about external behaviour. Same with clock. Math and map are deterministic logic." "Math and map are deterministic logic. Banned in tests." "Zod is the wire. We can use infer to create a native type we then use on an adapter to create our domain object." "For of mutates by its nature. It doesn't return. It's state holding required or side effect based." "no for of, use functional paradigms and avoid mutation, this solution is rejected" "Lodash is banned. Personal rule."
