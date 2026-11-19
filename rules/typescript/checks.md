# Checks in TypeScript

A check is how a [symptom](symptoms.md) is found. It is imperfect by design. "We aim for a check to find that. But we assess ways to narrow the margin of error and start with the 80/20 rule and reuse what we have where it is sufficient for first cut of mechanical ways to check what we are looking for."

So the symptom states exactly what is seen; a check aims at it and states its margin: what it flags that is not the symptom, and what it misses. An existing check that is sufficient for a first cut is reused.

Correct use at an authorised location is never margin: "it flagging the one allowed location is not a fault. It's what authorised locations are for".

Today's checks are addressed by clause. [Every CD](../numbers.md#every-mechanical-clause) gives the symptom each mechanical clause sees.

Package: an outside dependency. An internal package is our own code. Telling an outside dependency from an internal package needs the workspace layout, which is files and config Hone can read.

**Columns.**
- **Reports:** *seen* (where the symptom is), or *seen → breach* (it could also name the breach, given what follows the arrow).
- **Needs:** syntax, types, graph (imports between files), app (the app's structure), files (config, names, build output), history, person.
- **Today:**
  - *reuse:* a clause is enough for a first cut.
  - *partial:* a clause sees part of the symptom.
  - *review:* only a review clause covers it today.
  - *new:* nothing covers it today.
- **Margin:** what it flags that is not the symptom / what it misses. "Review owes" names what only a person sees.
- **Settings traced to:** each threshold or setting, and the rule or recipe sentence behind it. *Nothing* means no sentence says so.

## The outside world reached directly

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Date used directly | seen | syntax | reuse | `Date.now` in comments and strings / `performance.now()` | none |
| Ambient randomness | seen | syntax | new | — / — | none |
| Process global used in place | seen | syntax | review | — / — | none |
| Outside import past a boundary | seen | graph | partial | — / `import()`, `require`, globals | `confinedPackages`, empty by default on purpose: the universe of outside dependencies cannot be listed, and flagging every import would catch internal packages. Telling outside from internal needs the workspace layout, which Hone can read. |
| Outside type in a signature | seen → breach (the adapter that returns it, by types) | types | new | — / — | none |
| Library class built in place | seen | types | review | — / — | none |

## Text and schemas past their reader

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Text past its reader | seen → breach (the port that carries text, by types) | syntax; boundary records | partial (tests only) | — / production sites | the edition: **nothing** |
| Schema past its adapter | seen | graph; boundary records | review | — / — | none |

## Claimed or loose types

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Claimed type | seen → breach (the declaration, by types) | syntax | reuse | — / `any` reached through a package's types | `as const` allowed: Declared, not asserted |
| Untyped value | seen | syntax | reuse | — / — | none |
| Own type guard | seen | syntax | new | — / — | none |
| Type derived from code | seen | syntax | reuse | text in comments / `Parameters<typeof>`, `typeof` alone | none |
| Strictness weakened | seen | files | reuse (edition 2) | edition 1: a flag set to `true` / edition 1: a base reached by `extends` | flag list: The type checker proves it. Edition 1 flags presence, which is the Shared strict base config recipe: **traced to a recipe, not a rule** |
| Default on a closed union | seen | types | reuse | a `switch` over an open set / — | none |
| Boolean in a signature | seen | syntax | reuse | a predicate's boolean return / — | none |
| Absence standing for a state | — | person | only review | review owes it | — |
| Default for a required value | seen | types | review | — / — | none |

## Failures

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Throw between our units | seen | syntax; boundary records | review | — / — | authorised locations: "Throwing in specific places allowed is just authorised locations as prose" |
| Thrown non-error | seen | syntax | reuse | — / — | none |
| Failure shaped as success | — | person; syntax for a `catch` that returns | only review | review owes it | — |
| Catch-all failure kind | seen | types | new | — / — | none |

## Effects and state

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Loop keyword | seen | syntax | reuse | — / — | none |
| Write into a parameter | seen | syntax | reuse | — / — | none |
| Rebinding | seen | syntax | reuse | — / a local `let` in production | none |
| Authored class or this | seen | syntax | reuse | — / `this` outside a class | none |
| Module-level state | seen | syntax | new | — / — | none |

## Unit shape

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Long function | seen | syntax | reuse | — / — | 50 lines: where a broad symptom fires. "Line and complexity are symptoms that flag many things." Suite bodies not measured: "A test suite's body is a list of cases, not a coordinator." |
| Tangled function | seen | syntax | reuse | — / — | complexity 15: where a broad symptom fires (as above) |
| Work inside a condition | seen | syntax | partial | — / an `if` nested with no `else` | none |
| Orchestrator that computes | seen | types, graph | review | — / — | none |
| Doer calling our own unit | seen | types, graph | new | — / — | none |
| Positional parameters | seen | syntax for inline callbacks (passed straight to a call); types or the symbol graph for named ones | partial | — / our own functions with exactly two parameters | `max: 2`: a recorded compromise of the check, which cannot tell the two kinds apart. "Positional parameters is 2 because it flags functions designed to be used in native APIs even inline unnamed ones for things like map/reduce. Making 1 untenable."; "The check is not right. Its unable to distinguish." |
| Tuple as data | seen | syntax, types | new | — / — | none |
| Wide input | seen → breach (the input's declaration) | types | new | — / — | none |
| Wide port | seen → breach (the port) | types, graph | new | — / — | none |

## Layers and wiring

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Inner layer imports outer | seen | app (folder-to-layer config), graph | review | — / — | which folder is which layer: the adopter's top-level folder config |
| Port outside the domain | seen | graph, types | review | — / — | none |
| Adapter built outside the root | seen | graph | review | — / — | which module is the root: nothing yet |
| Port named for a mechanism | — | person | only review | review owes it | — |

## Tests

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Double with a body | seen → breach (the port it fills, by types) | syntax; types for hand-written doubles | reuse | — / hand-written doubles | test file is `.test.ts(x)`: Companion test file recipe |
| Module or global patched | seen → breach (the unit that imports the module, by graph) | syntax | partial | — / `vi.stubGlobal`, `process.env` set in a test | as above |
| Branch in a test | seen → breach (the type branched on, by types) | syntax | reuse | unit's own API (edition 1) / — | the edition: backwards compatibility for adopters since the npm release |
| Computed value in a test | seen | syntax | reuse | as above | as above |
| Throw or catch in a test | seen | syntax | reuse | — / `catch` | none |
| Unasserted call | seen | syntax, types | new | — / — | none |
| Test switched off | seen | syntax | reuse | — / `.todo` | `.todo` not flagged: a miss |
| Unit without a running test | seen | files, graph | reuse | — / an empty or non-running sibling | `__tests__` skipped by default, on purpose (noise; the practice is not adopted). `exclude` is scope. |
| Machine touched in a unit test | seen → breach (the unit with no port) | syntax; the suffix | new | — / — | integration test suffix: recipe ("keep pyramid checkable") |
| Inherited environment in a subprocess | seen | syntax, types | partial | — / `env` built from `process.env` under an accepted name | accepted helper names: **nothing**; `.spec`, `.js`, `.mjs` test files: **nothing** |
| Behaviour tested away from its owner | — | person; graph for candidates | only review | review owes it | — |
| Integration-heavy suite | seen | files (suffix) | review | — / — | the suffix: recipe |
| Coverage gate | seen | files | review | — / — | none |
| Large input for a few fields | — | person (the cast is Claimed type) | only review | review owes it | — |
| Test of the type checker | — | person | only review | review owes it | — |

## Names, prose and files

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Shorthand name | seen | syntax | reuse | — / shorthand not on the list | shorthand and filler list: Whole words recipe |
| Name off its casing | seen | syntax, files | reuse | — / — | Hone's own casing option lists: **nothing**; casing is the adopter's own lint |
| Drawer path | seen | files | reuse | — / a drawer under an ordinary name | drawer names: Screaming folders recipe |
| Types-only file | seen | syntax | new | — / — | port declarations allowed: Entity module recipe |
| Prose in code | seen | syntax | new | — / — | tracked pointer form: [records](../records.md#what-is-not-a-record) |
| Untracked escape | seen | syntax | reuse | — / — | reference form "need a digit": **nothing** |
| Many spellings of one concept | seen | files (the vocabulary list) | new | — / — | the Domain vocabulary list recipe |
| Package vocabulary for basic logic | seen | graph; workspace layout | new | — / — | which outside dependencies: nothing yet |
| Duplicate decision | — | person; clones surface candidates | only review | review owes the ruling ("reasons to change") | — |
| Change spread across modules | seen | history | new | — / — | none |

## Dependencies and versions

| Check for | Reports | Needs | Today | Margin | Settings traced to |
|---|---|---|---|---|---|
| Floating version | seen | files | new | — / — | Fixed versions |
| No lock file | seen | files | new | — / — | Fixed versions |
| Dependency without a record | seen | files; records | new | — / — | Packages justified |
| Tool fetched at run time | seen | files | new | — / — | Tools live in the repo |
| Edit inside vendored code | seen | history | new | — / — | which folder is vendored: a boundary record |
| Bundled dependency | seen | build output | new | — / — | Shipped risk declared (proposed, not accepted) |

## Findings that point at the breach

Several symptoms are seen far from their breach. Each finding has two addresses:
- where the symptom is seen;
- the rule or rules the symptom indicates, with the place the breach usually sits.

| Symptom seen | Where it is seen | Where the breach usually sits | What a check needs to name the breach |
|---|---|---|---|
| Double with a body | the test | the port's width, or a collaborator with two decisions | types: the port the double fills, and its uncalled methods |
| Large input for a few fields | the test (often a cast) | the unit's declared input | types: the parameter's declaration and the fields read |
| Branch in a test | the test | the type of the value branched on | types: the declaring type of the member read |
| Text past its reader (in a test) | the test | the port that carries text | types: the port method the text is fed to |
| Module or global patched | the test | the unit that imports what it should be passed | graph: who imports the mocked module |
| Machine touched in a unit test | the test | the unit with no port | graph: what the unit imports |
| Date used directly | the unit | a doer doing two jobs | person |
| Claimed type | the cast | the declaration it works around | types |

Until a check can name the breach, a finding names the rules the symptom points at and where the breach usually sits. It never says only "this line".

## Settings

A setting fails only if it changes what a rule requires. It does not fail when it:
- tunes how early a symptom fires: "Line and complexity are symptoms that flag many things.";
- is scope a codebase chose: "Exclude is any codebases choice to say this is not in scope. It's never bound by any rules."

A default that quietly narrows a rule, which no codebase chose, still fails.

**Settings that change what a rule requires today:**

| Setting | What it changes | Traced to |
|---|---|---|
| Strictness edition 1 flags a flag's presence | requires the recipe's layout, not strictness | a recipe, not a rule. "The older strictness check is probably just a flaw." |
| `.todo` not flagged | a test that does not run passes | a miss. "Todo not flagged is probably just a false negative." |
| Accepted helper names | The subprocess-environment check passes a git spawn when its `env:` option mentions one of three hard-coded identifiers: `hermeticGitEnvironment`, `withoutInheritedGitBindings` or `environment`. It matches the name, not what the value holds, so any variable called `environment` passes. | nothing; a margin of the check (it misses by name) |
| Casing fixed inside Hone | Today file names must be kebab-case or PascalCase, both allowed everywhere, hard-coded. Identifier casing is a fixed option list in Hone's own piece, built on typescript-eslint's naming-convention. The adopter declares neither. | nothing. "Casing should be config from adopter to declare for consistency but requires the folder nuance settings." |
| Tracked-reference form | which TODO counts as tracked | nothing yet |

**Settings that do not:**

| Setting | Why |
|---|---|
| 50-line limit, complexity 15 | where two broad symptoms fire; they change no rule |
| `max-params: 2` | a recorded compromise of the check; its miss is margin |
| `exclude` | scope chosen by the codebase |
| Edition defaults | "Edition defaults would be for backwards compatability since we went npm." An existing adopter keeps the behaviour it installed. |
| `confinedPackages` empty by default | "packages is empty because we can't define the universe and if we just said imports at all we would catch internal packages." Seeing every outside dependency needs a way to tell it from an internal package; until then the list is the adopter's to fill. |
| `__tests__` skipped by default | "probably because of noise level and the fact I don't adopt that folder practice deliberately at all." |
| `.spec.ts` not treated as a test file by most checks | "Spec is also just not a naming practice I use." Then: "It honestly should be config for user to declare file naming structure so we can match their conventions." The Companion test file and Integration test suffix recipes stay the default. |
| Generated folders skipped (`node_modules`, `dist` and the like) | not code of ours |
| Reading `.test.js` and `.test.mjs` in the subprocess-environment check | it widens one check, not narrows a rule |
| Suite-body exemption | "A test suite's body is a list of cases, not a coordinator." |
| Drawer names | Screaming folders |
| Shorthand list | Whole words |
| `as const` | Declared, not asserted |
| Integration suffix | its recipe |

## Folder-scoped settings

Hone has no folder-scoped settings yet. "glob or folder specific ruleset settings would be useful to smooth those" (React beside a Node server; GraphQL types generated in a boundary folder).

Checks whose convention can differ by folder in one repository:
- **Name off its casing.** Identifier and file-name conventions: a React folder's PascalCase components beside a Node server's kebab-case files.
- **Generated code at a boundary.** Checks that would read an outside generator's output as ours: Shorthand name, Name off its casing, Prose in code, Claimed type, Untyped value, Type derived from code, Unit without a running test.

What a folder-scoped setting does:
- It **smooths** a second convention, by choosing which convention a check measures a folder against.
- It **marks generated code** as an outside party's code at a boundary, under that boundary's record.

What it must not be able to do:
- **Switch a rule off for a folder.** That is a record: an authorised location with its why, or debt.
- **Change what a rule means.** For example, a looser line limit, a wider parameter count or a narrower test-file definition for a folder.

So a setting never deselects a clause and never carries debt.

`exclude` is different again. It is scope, outside the model. It needs no rule sentence and no record.
