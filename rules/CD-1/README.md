# CD-1: No any, ever

## Rule

`any` is the absence of a type: it tells the compiler to stop checking, and that hole propagates silently through every call site that consumes the value. The whole reason a type system exists — catching shape errors before runtime — is forfeited at each `any`. Reach for `unknown` and narrow at the read site, or a precise union. There are no carve-outs: every `any` is a violation regardless of stated reason.

The sections below describe what the audit and ESLint checks cover.

## Spirit

**What the friction is for.** A value with no type switches off checking for everything it touches. The friction makes "this value has a known shape" the cheapest thing to write, so the compiler keeps doing the work at every use instead of a reader doing it in their head.

**What a finding points at.** Match the sites against these causes.
- *Input never typed where it entered.* A request, file, parse or database row crossed in and nobody said what it is. Give it a concrete type at that boundary, checked at runtime.
- *A shape nobody named.* The value has a shape that was never declared. Declare it as a type or a union.
- *A library kept at arm's length.* The vendor's types were awkward, so they were dropped. Wrap the library once and hand the rest of the code your own type.
- *One function serving many shapes.* It takes anything because its callers differ. Split it, or make the variants an explicit union.

**Where to go.** Every value inside the codebase has a known type. Unknown data becomes concrete where it arrives, not somewhere further in. A high count is usually one or two boundaries that were never built; build those first and most sites go with them.

**Reactions to distrust.**
- "It's just tests." A test that needs an untyped value builds its input the wrong way. Build the real type.
- "The library forces it." It forces it at one call. One wrapping file holds that.
- "Swap it for unknown." Unknown carried inward is the same debt, deferred. Very few values should stay unknown past the boundary.

**Principles behind it.**
- *Parse, don't validate* (Alexis King). Turn untyped input into a typed value once, where it arrives, so everything after it can rely on the type.
- *Make illegal states unrepresentable* (Yaron Minsky). A precise type or union rules out shapes the code cannot handle; an untyped value rules out nothing.

See [the spirit of the rules](../SPIRIT.md) for the measure, ask, decide chain.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-1#any-cast` | audit | a type assertion whose text contains `any` |
| `CD-1#explicit-any` | eslint | an `any` type anywhere in a type position |
| `CD-1#implicit-any-let` | eslint | a `let` or `var` with neither a type annotation nor an initialiser |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A type assertion (`x as T` or `<T>x`) where the first 80 characters from the start of the assertion match `as any`, `: any` or `<any>`.
- Allowed: `as unknown`. Other casts are reported by CD-2 instead.
- A multi-argument generic such as `Map<string, any>` does not match and falls to CD-2. A bare annotation such as `let value: any` is not flagged; that part is left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-1/README.md).
- `hone-cd1/no-explicit-any` is typescript-eslint's `no-explicit-any` with default options. It flags every `any` type: annotations, type arguments such as `Map<string, any>`, and `as any`.
- `hone-cd1/implicit-any-let` flags a `let` or `var` declaration in a `.ts` or `.tsx` file that has neither a type annotation nor an initialiser, one report per declaration at its first such binding. Declaration files (`.d.ts`), `const`, and `for-in` and `for-of` heads are not flagged.
- Allowed: `unknown`, `let total = 0` and `let total: number`.

## Example violation
```ts
const parsed = JSON.parse(text) as any;
```

## How to fix
```ts
const parsed: unknown = JSON.parse(text);
```
Narrow `unknown` with a schema or a type guard at the point of use.

## Exceptions
CD-1 is exempted like any other discipline: record an `authorised-location`, a `file-carve-out` for existing debt, or a clause-wide carve-out in `discipline-exceptions.json`. A carved or authorised file keeps its existing `any`; an `any` anywhere else still fails. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).
