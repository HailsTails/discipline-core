import { describe, expect, it } from "vitest";
import {
  allowCasesOf,
  allowedBlocksOf,
  cd27ChecksPageOf,
  FORM_FILE,
  repositoryRootOf,
  rowsNamed,
  sectionNamesOf,
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

describe("typeErrorsOf", () => {
  it("reports reading an indexed element that may be missing, as noUncheckedIndexedAccess types it", () => {
    expect(
      typeErrorsOf({
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
      }),
    ).toEqual([
      { name: "indexed", errors: ["Object is possibly 'undefined'."] },
      { name: "narrowed", errors: [] },
      { name: "optional", errors: [expect.any(String)] },
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
