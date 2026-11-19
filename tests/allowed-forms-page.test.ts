import { describe, expect, it } from "vitest";
import { allowedFormSectionsOf, sectionSlugOf } from "./allowed-forms-page.ts";

const PAGE = `# XX-1 checks

## How to fix
\`\`\`ts
outside();
\`\`\`

## Allowed forms in a test
Each section shows a flagged form first.

### An optional chain after an index
\`\`\`ts
expect(rows[0]?.id).toBe("a");
\`\`\`
Compare the whole element:

\`\`\`ts
expect(rows[0]).toMatchObject({ id: "a" });
\`\`\`

\`\`\`json
{ "not": "typescript" }
\`\`\`

### A section with only prose
Nothing to show.

### A Math call
\`\`\`ts
Math.round(2.5);
\`\`\`

## Exceptions
\`\`\`ts
after();
\`\`\`
`;

const CRLF_PAGE = "## Allowed forms in a test\r\n### A Math call\r\n```ts\r\nMath.round(2.5);\r\n```\r\n";

describe("allowedFormSectionsOf", () => {
  it("reads each section of the allowed forms part as its heading, slug, flagged block and allowed blocks", () => {
    expect(allowedFormSectionsOf({ page: PAGE })).toEqual([
      {
        heading: "An optional chain after an index",
        section: "an-optional-chain-after-an-index",
        flagged: "expect(rows[0]?.id).toBe(\"a\");\n",
        allowed: ["expect(rows[0]).toMatchObject({ id: \"a\" });\n"],
      },
      { heading: "A Math call", section: "a-math-call", flagged: "Math.round(2.5);\n", allowed: [] },
    ]);
  });

  it("reads a page written with CRLF line endings as if it had LF", () => {
    expect(allowedFormSectionsOf({ page: CRLF_PAGE })).toEqual([
      { heading: "A Math call", section: "a-math-call", flagged: "Math.round(2.5);\n", allowed: [] },
    ]);
  });

  it("reads nothing from a page with no allowed forms part", () => {
    expect(allowedFormSectionsOf({ page: "# XX-1 checks\n\n## How to fix\n" })).toEqual([]);
  });
});

describe("sectionSlugOf", () => {
  it.each([
    { heading: "An optional chain after an index", slug: "an-optional-chain-after-an-index" },
    { heading: "A `let`", slug: "a-let" },
    { heading: "Using JSON.parse", slug: "using-jsonparse" },
  ])("slugs $heading as $slug, as GitHub does", ({ heading, slug }) => {
    expect(sectionSlugOf({ heading })).toBe(slug);
  });
});
