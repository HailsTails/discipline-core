# The spirit of the rules

## What the friction is for

Every rule here is deliberate friction. None of it is arbitrary. Each rule makes the path of least resistance the good one, so the easy outcome and the good outcome are the same outcome. Each rule also holds the present self to account for the future self who inherits the code.

The friction is absolute on purpose. An escape inside a rule is a hole, and a hole justifies not thinking the design through. One permitted escape becomes the reason for the next.

A finding is rarely about the line it names. It is a signal about the design around that line: a boundary that is missing, an earlier choice that forces the workaround, a port wider than its callers need. Listen to what the friction is telling you. The real problem is almost never the checker.

## When the check is red

Take this chain, in order.

1. **Measure.** Count the sites for the failing clause. Group them by folder, by the value or dependency involved, and by who wrote them when.
2. **Ask what each group points at.** Read the rule's Spirit section and match each group against its usual causes. Most groups share one cause.
3. **Then decide.** Name the cause, where it lives, the forward goal, and the first step that unlocks it. Fix the cause and the sites go with it.

Exclusions and settings are not the first move. Reaching for one before step 2 hides the signal before anyone has read it. A count that looks like noise is usually one missing boundary seen from many places.

## Debt, not noise

On first adoption of an existing codebase, a high count is debt made visible. It is not evidence the rule is wrong for the codebase. The useful response is an assessment for each high-count clause: which cause applies here, where, the forward goal, and the steps toward it. A file carve-out holds that debt at rest while the steps are taken. Touching the file pays it ([CD-46](CD-46/README.md)).

## Boundaries are where exceptions belong

Some code has to touch the outside: a library, the runtime, raw input. Those places are boundaries. A clean boundary is the cheap, authorised place for what the rules forbid elsewhere: one file, recorded once, small enough to read whole. The rest of the code then needs no escape. If an exception keeps wanting to spread, the boundary is in the wrong place or does not exist yet.

## Not adopted, waived, escaped

Three different things. Only the third is a hole.

1. **Not adopted.** The codebase is not held to the rule at all. That is a tech lead's declared choice for the whole codebase, made in the open.
2. **A waived clause.** The rule still binds. What is set aside is one mechanical check: in this codebase it is not a true measure of the rule's intent, or it cannot work here for a technical reason. The waiver is about the mechanism and is recorded with that reason. The intent is still owed, through review now and a better check later.
3. **An escape at a site.** The rule is adopted, its check is sound, and one place steps around it. That keeps the rule's name and loses its effect. It is the hole that justifies not thinking the design through.

Choose 1 or 2 deliberately, with reasons. Do not do 3.

## Tests are code

Tests are not exempt. A test that needs a cast, a fake with logic, a module intercept or a branch is reporting on the unit's seams. The test is the unit's first consumer. The fix usually belongs in the unit's design, not in the test.

## Older than these rules

These rules are not one person's taste. Each encodes lessons programmers learned before us and wrote down under names you can look up: the SOLID principles, ports and adapters, "parse, don't validate", making illegal states unrepresentable, the test pyramid, the kinds of test double, and others. Each rule page names the principles behind it, with one line on how each applies. Read them to learn the pattern and the reasoning, not only the rule.

## Who does what

Each rule's Spirit section names the usual causes behind its findings and the direction each points, so a reader can tell which one they have. The repository's own assessment then sharpens that to what is specific to the codebase and its intentions: which cause applies, where, the forward goal and the steps. It does not repeat the rule.
