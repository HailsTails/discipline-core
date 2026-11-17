# CD-7: No categorical filenames or folder names

## Rule

A file or folder is named for the abstraction it holds, not for a category of things. A junk-drawer name (utils, helpers, common, shared, types, misc) signals a missing primitive: the code inside wants a real home named for what it does. Category names accrete unrelated code because anything can be justified into them.

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags. What each check flags, how to fix a flagged site, and how to record an exception: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A name is the first design decision a reader meets. A category name accepts anything, so code drifts into it without anyone deciding where it belongs. The friction forces the question "what is this?" at the moment it is cheapest to answer.

**What a finding points at.** Match the paths against these causes.
- *A concept nobody named.* The drawer holds functions that all serve one idea the codebase never named, such as money, dates or identifiers. Name the idea and give it a module.
- *Shared by accident.* Code moved to a common place because two callers needed it. Decide whether it belongs to one of them or is a concept of its own.
- *Shapes separated from their owners.* A types file holds shapes far from the code that uses them. Put each shape beside the code it describes.
- *Folders sorted by kind.* The tree groups things by what they are, not by what they do. Group by capability.

**Where to go.** Every file and folder name says what it holds, so a reader finds code by asking what it does. The rename is the small part; finding the concept behind it is the work.

**Reactions to distrust.**
- "It's just a name." The name is where the missing concept shows. A synonym such as "core" or "base" keeps the drawer.
- "The framework requires that path." Then authorise that path. What you add under it still needs a real home.
- "We'll sort it later." Category folders only grow.

**Principles behind it.**
- *Screaming architecture* (Robert C. Martin). The folder structure should tell a reader what the system does, not which kinds of file it contains.
- *Single Responsibility Principle* (Robert C. Martin, SOLID). A module has one reason to change. A drawer of unrelated helpers has as many reasons as it has helpers.
- *Primitive Obsession* (a code smell in Fowler's *Refactoring*). Helpers that all handle one raw value, such as an amount or a date string, usually mark a domain type nobody created.
