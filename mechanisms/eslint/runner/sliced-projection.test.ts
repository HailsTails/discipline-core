import { describe, expect, it, vi } from "vitest";
import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { CAUSAL_WHY_CHAIN } from "../../../tests/causal-why-chain.ts";
import { overlaidFileText } from "../../../tests/overlaid-file-text.ts";
import { projectionText } from "./projection.ts";
import type { ConfigRoot } from "./projection-slices.ts";
import {
  packageSliceProblemsOf,
  type ProjectionClause,
  type SliceOrigin,
  slicedProjectionWrites,
  sliceTextOf,
} from "./sliced-projection.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const eslint = mechanismIdSchema.parse("eslint");

const CLASS_CLAUSE: ProjectionClause = {
  address: classSyntax,
  ruleId: "hone/no-class-authoring",
  options: [],
  pluginNamespace: "hone",
  pieceRoot: "/repo/mechanisms/eslint/CD-14",
  pluginModule: "cd14.eslint-plugin.ts",
};

const ORIGIN: SliceOrigin = {
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  repoRoot: absolutePathSchema.parse("/repo"),
  install: { form: "source" },
};

const WINDOWS_ORIGIN: SliceOrigin = {
  path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
  repoRoot: absolutePathSchema.parse("C:\\repo"),
  install: { form: "source" },
};

const REPOSITORY: ConfigRoot = { placement: "repository" };
const PACKAGE_A: ConfigRoot = { placement: "package", directory: repoPathSchema.parse("packages/a") };

const carveOutInLegacy: ExceptionRecord = {
  kind: "file-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("packages/a/src/legacy.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: CAUSAL_WHY_CHAIN,
};

const authorisedInRootSource: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional unit fixture mechanisms/eslint/runner/sliced-projection.test.ts; not historical authorisation",
  },
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/adapter.ts"),
  reason: "Structural location for the vendor adapter",
};

const PACKAGE_PIECE = {
  pluginNamespace: "hone",
  pluginImport: "../../mechanisms/eslint/CD-14/cd14.eslint-plugin.ts",
  clauses: [{ address: classSyntax, ruleId: "hone/no-class-authoring", options: [] }],
};

const PACKAGE_A_SLICE = projectionText({
  selectedPieces: [PACKAGE_PIECE],
  records: [{ ...carveOutInLegacy, file: repoPathSchema.parse("src/legacy.ts") }],
});

const EMPTY_PACKAGE_SLICE = projectionText({ selectedPieces: [PACKAGE_PIECE], records: [] });

const noFiles = (request: { readonly write: FileTextPort["write"] }): FileTextPort => ({
  read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }),
  exists: () => "absent",
  write: request.write,
});

const writing = () => vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });

const removing = () => vi.fn<FileRemovalPort["remove"]>().mockReturnValue({ outcome: "ok", value: undefined });

describe("sliceTextOf", () => {
  it("imports the plugin relative to the package folder and keeps only that package's records, re-pathed to it", () => {
    expect(
      sliceTextOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy, authorisedInRootSource],
        origin: ORIGIN,
        root: PACKAGE_A,
      }),
    ).toEqual({ outcome: "ok", value: PACKAGE_A_SLICE });
  });

  it("gives the repository root every record with root-relative paths and a root-relative import", () => {
    expect(
      sliceTextOf({ clauses: [CLASS_CLAUSE], records: [carveOutInLegacy, authorisedInRootSource], origin: ORIGIN, root: REPOSITORY }),
    ).toEqual({
      outcome: "ok",
      value: projectionText({
        selectedPieces: [{ ...PACKAGE_PIECE, pluginImport: "./mechanisms/eslint/CD-14/cd14.eslint-plugin.ts" }],
        records: [carveOutInLegacy, authorisedInRootSource],
      }),
    });
  });

  it("is piece-invalid when the piece is on another drive from the package it would be imported into", () => {
    expect(
      sliceTextOf({
        clauses: [{ ...CLASS_CLAUSE, pieceRoot: "D:\\pieces\\CD-14" }],
        records: [],
        origin: WINDOWS_ORIGIN,
        root: PACKAGE_A,
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: "D:\\pieces\\CD-14" } });
  });
});

describe("packageSliceProblemsOf", () => {
  it("names a package slice that is absent as missing", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        fileText: noFiles({ write: writing() }),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [{ slice: "packages/a/disciplines.eslint.mjs", state: "missing" }] });
  });

  it("names a package slice whose bytes differ from its generation as out-of-date", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        fileText: overlaidFileText({
          base: noFiles({ write: writing() }),
          files: { "/repo/packages/a/disciplines.eslint.mjs": EMPTY_PACKAGE_SLICE },
        }),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [{ slice: "packages/a/disciplines.eslint.mjs", state: "out-of-date" }] });
  });

  it("names nothing for a current package slice and never names the repository root's projection", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        fileText: overlaidFileText({
          base: noFiles({ write: writing() }),
          files: { "/repo/packages/a/disciplines.eslint.mjs": PACKAGE_A_SLICE },
        }),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
});

describe("slicedProjectionWrites over the config roots", () => {
  it("writes one slice per config root, the repository root first, each at its own folder", () => {
    const write = writing();

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        fileText: noFiles({ write }),
        fileRemoval: { remove: removing() },
        roots: [REPOSITORY, PACKAGE_A],
        trackedPaths: [],
      }),
      written: write.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
        ],
      },
      written: [
        [{ path: "/repo/disciplines.eslint.mjs", text: expect.any(String) }],
        [{ path: "/repo/packages/a/disciplines.eslint.mjs", text: PACKAGE_A_SLICE }],
      ],
    });
  });
});

describe("slicedProjectionWrites over tracked slices outside every config root", () => {
  it("removes a tracked slice whose folder is no longer a config root when its bytes are exactly what Hone would write there", () => {
    const remove = removing();

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        fileText: overlaidFileText({
          base: noFiles({ write: writing() }),
          files: { "/repo/packages/old/disciplines.eslint.mjs": EMPTY_PACKAGE_SLICE },
        }),
        fileRemoval: { remove },
        roots: [REPOSITORY],
        trackedPaths: [repoPathSchema.parse("packages/old/disciplines.eslint.mjs")],
      }),
      removed: remove.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/old/disciplines.eslint.mjs", effect: "removed" },
        ],
      },
      removed: [[{ path: "/repo/packages/old/disciplines.eslint.mjs" }]],
    });
  });

  it("leaves a tracked slice outside every config root in place when its bytes are not what Hone would write", () => {
    const remove = removing();

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        fileText: overlaidFileText({
          base: noFiles({ write: writing() }),
          files: { "/repo/packages/old/disciplines.eslint.mjs": "export default [];\n" },
        }),
        fileRemoval: { remove },
        roots: [REPOSITORY],
        trackedPaths: [repoPathSchema.parse("packages/old/disciplines.eslint.mjs")],
      }),
      removed: remove.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/old/disciplines.eslint.mjs", effect: "left-in-place" },
        ],
      },
      removed: [],
    });
  });
});

describe("slicedProjectionWrites when a stale slice cannot be removed", () => {
  it("is tool-failed with the port's detail when a stale slice cannot be removed", () => {
    expect(
      slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        fileText: overlaidFileText({
          base: noFiles({ write: writing() }),
          files: { "/repo/packages/old/disciplines.eslint.mjs": EMPTY_PACKAGE_SLICE },
        }),
        fileRemoval: {
          remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "unremovable", path: "/repo/packages/old/disciplines.eslint.mjs", detail: "EPERM" },
          }),
        },
        roots: [REPOSITORY],
        trackedPaths: [repoPathSchema.parse("packages/old/disciplines.eslint.mjs")],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "EPERM" } });
  });
});

describe("slicedProjectionWrites on Windows paths", () => {
  it("writes a package slice at its Windows form under the repo root", () => {
    const write = writing();

    slicedProjectionWrites({
      clauses: [{ ...CLASS_CLAUSE, pieceRoot: "C:\\repo\\mechanisms\\eslint\\CD-14" }],
      records: [],
      origin: WINDOWS_ORIGIN,
      fileText: noFiles({ write }),
      fileRemoval: { remove: removing() },
      roots: [PACKAGE_A],
      trackedPaths: [],
    });

    expect(write.mock.calls).toEqual([[{ path: "C:\\repo\\packages\\a\\disciplines.eslint.mjs", text: EMPTY_PACKAGE_SLICE }]]);
  });
});
