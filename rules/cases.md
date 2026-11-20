# Cases

A case is what the code is trying to do. It is where the why is owed. A case may owe more than one why. "Owes" lists principles by short name; the first one decides what to do.

Short names: Tests ([Tests are ours](principles.md#tests-are-ours)), One place ([One place decides](principles.md#one-place-decides)), Effects ([No hidden effects](principles.md#no-hidden-effects)), Boundary ([External behaviour sits at a boundary](principles.md#external-behaviour-sits-at-a-boundary)), Leak ([No leak across a boundary](principles.md#no-leak-across-a-boundary)), Checker ([The type checker proves it](principles.md#the-type-checker-proves-it)), Language ([Our code reads in the common language](principles.md#our-code-reads-in-the-common-language)), Outside risk ([Outside risk is carried on purpose](principles.md#outside-risk-is-carried-on-purpose)).

Cases name no language, tool or library.

## Tests are ours

| Case | Owes | What to do |
|---|---|---|
| Uses what a collaborator gives back | Tests; One place | Every collaborator whose result it uses, our own units included, is passed in. The test stubs it with a written-out value and asserts only what the unit returns and calls. A stub that needs logic means the port or the collaborator holds too much: fix that. |
| States what the unit gives back, for one case or several | Tests; One place | Each test is one complete, distinct case. The expected value is written out, never worked out. Several cases are each written out; nothing in the test builds or picks them. No throw or catch in a test. |
| Checks a value that may be one of several outcomes | Tests; Checker | An assertion proves which outcome it is, so the type narrows; then the test reads it plainly. No condition, optional read or cast. |
| Gives each unit its test | Tests; One place | Every unit has its own test in the companion file, and it runs. A unit that only wires has a test of its wiring. No coverage figure stands in. |
| Tests across units or against a real system | Tests; One place | Each behaviour is tested at the level that owns it. An integration test checks only a binding to the outside, or that units join. It is the only place a file on disk or a real subsystem belongs, and only the one its binding needs. It inherits nothing from the machine. |

Quoted reasons: "If it calls something and uses its output we hardcode that output using DI." "no for each in tests, hard coded and not dynamic only" "No conditional run time checks within an expect. Use an assert to narrow and standard expects" "if its a unit test it covers the unit it is the companion file to" "They are integration test tools. Per my code disciplines they are for the boundary it needs only."

## One place decides

| Case | Owes | What to do |
|---|---|---|
| Coordinates other units | One place; Tests | It picks which of our units run, in what order, and passes their results on. Branching, computing or reshaping between calls is its own unit. A unit that only forwards one call decides nothing: fold it in. A test suite's body is a list of cases, not a coordinator. |
| Does one job | One place; Checker | One decision. It calls no other unit of business logic; it may call ports passed in to it. A second question, a mode picked by a true-or-false argument, or a mix of results is a second unit. |
| Checks conditions before its work | One place; Checker | Each condition that ends the work returns at once, at one level. The work is the last return, never nested in a condition. |
| Builds the real implementations | One place; Boundary | One place, at start-up, builds every real implementation and passes it in. Nothing else builds one. |
| Reuses behaviour from another unit or type | One place; Language | Two callers share a unit only when it is one decision for both. Shared behaviour is a call to that unit, never inheritance. |
| Puts code in a file or folder | One place; Language | A module holds what changes for one reason, named for that domain concept. A domain type lives with its logic; a file of types alone holds only port declarations. A drawer of unrelated pieces, test helpers included, has no home. |

Quoted reasons: "I hold to functions are doers or are orchestrator a teaching." "If it's long it's doing too many things inline." "If nested it's a poorly modelled set of questions for a single job." "the choice of duplicate or not or boundary or not is pretty much always a deep think on "reasons to change"" "all types have a purpose. that purpose is its reason to exist and its reason to change" "dry is true but it must be held with reasons to change not "same functional code right now""

## No hidden effects

| Case | Owes | What to do |
|---|---|---|
| Makes a new value from what it has | Effects; One place | It returns a new value. Nothing it was given or already made changes after it is made. A stream is drained only in its source's adapter, at a recorded site. |
| Causes an effect (writes, logs, sends, exits) | Effects; Boundary, One place | The effect is a call on a port passed in, and its test checks that call. |
| Keeps state or settings across calls | Effects; Checker | Settings are passed in when the unit is built. State that changes between calls lives only in an adapter, behind a port. |

Quoted reasons: "An effect can be checked at the units seam is about testing what is ours not what isn't." "this is a bunch of nullable and state management mess"

## External behaviour sits at a boundary

| Case | Owes | What to do |
|---|---|---|
| Needs the current time, a random value, a new id or an outside ordering | Boundary; One place, Tests | One unit makes the value and does nothing else. Every other unit is passed the value, not its source. The source is a port; its stub returns a written-out value. |
| Uses a system or service outside the program | Boundary; Leak, One place | Business logic is handed a port named for the capability, not the mechanism, speaking only our types. One implementation per capability touches it and may fill several narrow ports. The protocol is its own adapter. Each adapter is a recorded boundary. |

Quoted reasons: "we have a clock, why is bare date being used?" "Yes the library and the data are different reasons to change. Often why we have a port for http and a port for the specific resource/domain that utilises the http port to access it."

## No leak across a boundary

| Case | Owes | What to do |
|---|---|---|
| Reads data from outside (request, file, environment, stored row, response) | Leak; Boundary, Checker | The reader for whoever produced it parses it once, at the boundary, into a type of our own. A required value that is missing is a failure, never a default. A test never sets the environment. Past the reader, units and their tests use objects, never text. |
| Sends data out of the program | Leak; One place | Business logic hands the adapter our own value. Only the adapter maps it to the receiver's form. |

Quoted reasons: "I didn't want a json parse wrapper. I wanted a boundary on whoever made json" "our usecase of literal json should only be boundaries that are using json. As we should be runtime objects not json as soon as we leave a boundary" "no default, must be provided as env var"

## The type checker proves it

| Case | Owes | What to do |
|---|---|---|
| An operation can fail | Checker; Boundary | Every way it fails is a named variant in its return type. Nothing is thrown, ends the process, becomes true or false, or is swapped for a default or an empty value. Callers handle each variant. |
| A value is one of several kinds or states | Checker; Language | A closed union of our own, a name per kind, no catch-all. Absence or a true-or-false that stands for a state is a named kind. |
| Gives a value its type (declares it, or needs it narrower) | Checker; One place, Leak | It admits exactly what the code relies on, named, never derived from an implementation. To narrow it, fix the declaration or the parse; nothing asserts over it, tests included. A doer takes only the fields it reads. |
| Sets how strictly the checker works | Checker | One setting, the strictest, for every unit. None weakens it. |

Quoted reasons: "sounds like a rule of the type checker in a way. As it makes the output clear to type system instead of hidden in throws" "way too much casting, hint: the correct amount of casting is **0**"

## Our code reads in the common language

| Case | Owes | What to do |
|---|---|---|
| Names something | Language; One place | The domain's word, the same everywhere, at every scope. Values that travel together are named fields, never a position. If only a generic word fits, split it. An outside contract's names stay in its boundary. |
| Explains something in prose | Language; Checker | The meaning goes in a name or a type. The only annotations are a pointer to a tracked issue and a tool directive. |
| Writes basic logic (branching, matching, transforming, results) | Language; Outside risk | In the language's own constructs. No outside dependency's vocabulary stands in for it. |

Quoted reasons: "dont care if its a lambda function or not, meaningful names always" "If the code isn't self explanatory that's the problem. You shouldn't need usage notes at all." "language additions beyond the common language expected of engineers in the space and language obscuring standard operations."

Meaning by name, never by position: a unit whose signature is ours takes one argument; a callback shaped by an outside API takes what that API passes.

## Outside risk is carried on purpose

| Case | Owes | What to do |
|---|---|---|
| Takes an outside dependency | Outside risk; Language, Boundary, One place | A record names the native way weighed and why it was not enough. It is used only inside the recorded boundary that needs it, with no wrapper, and its types and vocabulary never reach business logic. It never makes one of our decisions. |

Quoted reasons: "Packages need a justification for the maintenance they add."

Outside dependency: what was called a package. An internal package is our own code. An internal package falls under One place decides and the layering, not this case.

### Proposed cases

Proposed, not accepted.

| Case | Owes | What to do |
|---|---|---|
| Ships code for others | Outside risk | What we ship is visible to an adopter's scanner. It is the case of the proposed rule [Shipped risk declared](rules.md#shipped-risk-declared). |
| An adopter is not handed our risk | Outside risk | A case under [Outside dependencies justified](rules.md#outside-dependencies-justified). A peer dependency is a direct dependency of ours, so it needs a record. The risk it weighs is carried by whoever runs it, the adopter included. |

## Outside the cases

- **Sensitive data:** safety is their why; no principle forces them.
- **Records and debt:** see [records](records.md).
- **A named ban:** no record makes it correct. Existing use is still held as debt, like any symptom.
- **How rules and checks are written:** spirit pure, strict wording, checks imperfect by design.
- **Process:** root cause over a guard, no deferring, no ask-me exits, no parallel machinery.
