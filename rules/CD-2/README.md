# CD-2: Closed enumerated list of permitted cast sites

## Rule

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it, each one an exception record for the file at that boundary. Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.

The sections below describe what the audit check covers.

## Spirit

**What the friction is for.** A cast is a claim the compiler cannot check. The friction makes the honest route, parsing the value or fixing its type, the easy one. The few claims that remain are visible and sit in known places.

**What a finding points at.** Match the sites against these causes.
- *Parsing skipped at a boundary.* Raw input is asserted into shape instead of checked. Parse it once where it enters and the type follows.
- *A declared type that is wrong.* The code builds something its type does not describe. Fix the declaration and the cast goes.
- *A boundary that is missing.* Casts cluster around one library or data source across many files. Make one wrapping file the boundary and keep the rest cast-free.
- *A return type wider than its use.* A function returns a broad type and every caller narrows it. Return the narrow type.
- *A parameter type wider than its use.* A function asks for a whole record but reads two fields. It shows in tests, where someone casts a two-field object through to the full type rather than build it all. The function asks for more than it needs. Accept only the fields it uses; the test then builds those two fields honestly.

**Where to go.** Casts live only in a few named boundary files, each recorded as an authorised location. Clean boundaries make that cheap; that is what authorised locations are for. Everywhere else the type follows from a check.

**Reactions to distrust.**
- "It's just tests." Tests are violations too. A test that casts is building a value its type does not allow. Either build it properly, or the unit asks for more than it uses.
- "Add a permission for this shape." Measure first. A permission can hide a real defect, such as database rows that were never parsed.
- "The library forces it." It forces one site. Put that site in the wrapping file.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). A parse produces the type; a cast only claims it. Parse once at the boundary and the claim is never needed.
- *Interface Segregation Principle* (Robert C. Martin, SOLID). Depend only on what you use. A parameter that asks for exactly the fields it reads needs no cast to satisfy, in production or in tests.
- *Ports and adapters* (Alistair Cockburn, hexagonal architecture). The adapter at the edge is where outside shapes are translated, so it is the one place an unavoidable assertion belongs.

See [the spirit of the rules](../SPIRIT.md) for the measure, ask, decide chain.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-2#cast-expressions` | audit | a type assertion that is not on the permitted list |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion except a const assertion, `as const` or `<const>x`. Assertions whose type contains `any` are CD-1's and are not repeated here.
- `as unknown` and `<unknown>x` are flagged. Widening never needs an assertion: annotate instead, `const parsed: unknown = JSON.parse(text)`.
- A cast through `unknown`, such as `raw as unknown as User`, `(<unknown>raw) as User` or one wrapped in `!` or `satisfies`, is flagged with its own message, and so is its `unknown` half. It is the escape hatch that turns any value into any type; check the value's shape at runtime at the boundary instead.
- Test files, test helpers and scripts are checked like any other source; a test that needs a cast needs a typed fake or a narrower port.
- There are no settings: a boundary that forces a cast is an exception record, as below.

## Example violation
```ts
const user = response as User;
```

## How to fix
```ts
const user = userSchema.parse(response);
```
Parse or narrow the value so the type follows from a check rather than from an assertion.

When handing a value across a boundary truly forces a cast, such as a library that types its schemas loosely or a database driver that returns unparsed rows, put the cast in the one adapter file at that boundary and record that file as an `authorised-location` with a why-chain. With clean boundaries that is one file and one record; casts scattered across many files are the sign the boundary is missing.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file sits on an external boundary that forces an assertion, such as an adapter. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-2#cast-expressions", "file": "src/adapters/row-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
