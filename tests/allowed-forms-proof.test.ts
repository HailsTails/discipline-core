import { describe, expect, it } from "vitest";
import {
  allowCasesOf,
  allowedBlocksOf,
  cd27ChecksPageOf,
  FORM_FILE,
  repositoryRootOf,
  rowsNamed,
  sectionNamesOf,
  typeErrorsAmong,
  typeErrorsOf,
  VITEST_PRELUDE,
} from "./allowed-forms-proof.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const REPO_ROOT = repositoryRootOf({ testFolder: import.meta.dirname });

const SYNTAX_API = defaultParsePort.syntaxApi;

const SECTIONS = [
  { heading: "A ternary", section: "a-ternary", flagged: "ok ? 1 : 2;\n", allowed: ["expect(1).toBe(1);\n", "expect(2).toBe(2);\n"] },
  { heading: "A Math call", section: "a-math-call", flagged: "Math.round(2.5);\n", allowed: [] },
];

const TYPE_ERRORS_OF_THREE_FORMS = typeErrorsOf({
  syntaxApi: SYNTAX_API,
  repoRoot: REPO_ROOT,
  blocks: [
    { name: "indexed", source: "declare const rows: readonly { readonly id: string }[];\nexpect(rows[0].id).toBe(\"a\");\n" },
    {
      name: "narrowed",
      source: "declare const rows: readonly { readonly id: string }[];\nconst [first] = rows;\nassert.isDefined(first);\nexpect(first.id).toBe(\"a\");\n",
    },
    { name: "optional", source: "const options: { readonly limit?: number } = { limit: undefined };\nexpect(options).toEqual({});\n" },
  ],
});

describe("typeErrorsOf", () => {
  it("reports reading an indexed element that may be missing, as noUncheckedIndexedAccess types it", () => {
    expect(TYPE_ERRORS_OF_THREE_FORMS.blocks).toContainEqual({ name: "indexed", errors: ["Object is possibly 'undefined'."] });
  });

  it("accepts the element once assert.isDefined has narrowed it", () => {
    expect(TYPE_ERRORS_OF_THREE_FORMS.blocks).toContainEqual({ name: "narrowed", errors: [] });
  });

  it("reports an optional property given undefined, as exactOptionalPropertyTypes types it", () => {
    expect(TYPE_ERRORS_OF_THREE_FORMS.blocks).toContainEqual({ name: "optional", errors: [expect.any(String)] });
  });

  it("reports no diagnostic outside the forms when each form compiles on its own terms", () => {
    expect(TYPE_ERRORS_OF_THREE_FORMS.unattributed).toEqual([]);
  });
});

describe("typeErrorsAmong", () => {
  const FORMS = [
    { name: "first", path: "/repo/allowed-form-0.test.ts" },
    { name: "second", path: "/repo/allowed-form-1.test.ts" },
  ];

  it("gives each form the diagnostics in its own file", () => {
    expect(
      typeErrorsAmong({
        forms: FORMS,
        diagnostics: [
          { fileName: "/repo/allowed-form-1.test.ts", message: "in second" },
          { fileName: "/repo/allowed-form-0.test.ts", message: "in first" },
        ],
      }),
    ).toEqual({
      blocks: [
        { name: "first", errors: ["in first"] },
        { name: "second", errors: ["in second"] },
      ],
      unattributed: [],
    });
  });

  it("keeps a diagnostic with no file as unattributed, so a broken option set cannot pass a form", () => {
    expect(typeErrorsAmong({ forms: FORMS, diagnostics: [{ fileName: undefined, message: "option 'strict' is invalid" }] })).toEqual({
      blocks: [
        { name: "first", errors: [] },
        { name: "second", errors: [] },
      ],
      unattributed: ["option 'strict' is invalid"],
    });
  });

  it("keeps a diagnostic in another file as unattributed, naming the file", () => {
    expect(typeErrorsAmong({ forms: FORMS, diagnostics: [{ fileName: "/repo/core/imported.ts", message: "broken through an import" }] }).unattributed).toEqual([
      "/repo/core/imported.ts: broken through an import",
    ]);
  });
});

describe("allowedBlocksOf", () => {
  it("names each allowed block by its section and its place in that section", () => {
    expect(allowedBlocksOf({ sections: SECTIONS })).toEqual([
      { name: "a-ternary 1", source: "expect(1).toBe(1);\n" },
      { name: "a-ternary 2", source: "expect(2).toBe(2);\n" },
    ]);
  });
});

describe("allowCasesOf", () => {
  it("makes each block an allow case in a test file, after the vitest import", () => {
    expect(allowCasesOf({ blocks: [{ name: "a-ternary 1", source: "expect(1).toBe(1);\n" }] })).toEqual([
      { name: "a-ternary 1", fileName: FORM_FILE, source: `${VITEST_PRELUDE}expect(1).toBe(1);\n`, expectedLines: [] },
    ]);
  });
});

describe("sectionNamesOf", () => {
  it("lists the sections in page order", () => {
    expect(sectionNamesOf({ sections: SECTIONS })).toEqual(["a-ternary", "a-math-call"]);
  });
});

describe("rowsNamed", () => {
  it("keeps the rows with a listed name, in their own order", () => {
    expect(rowsNamed({ rows: [{ name: "b" }, { name: "a" }, { name: "c" }], names: ["a", "b"] })).toEqual([{ name: "b" }, { name: "a" }]);
  });
});

describe("cd27ChecksPageOf", () => {
  it("reads CD-27's CHECKS.md from the repository root", () => {
    expect(cd27ChecksPageOf({ repoRoot: REPO_ROOT })).toContain("## Allowed forms in a test");
  });

  it("reads nothing from a root with no rule pages", () => {
    expect(cd27ChecksPageOf({ repoRoot: `${REPO_ROOT}/absent-root` })).toBe("");
  });
});
