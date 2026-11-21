import { describe, expect, it } from "vitest";
import { AUDIT, CAST_EXPRESSIONS, ESLINT, REPORT_CATALOGUE } from "../../tests/report-catalogue.ts";
import type { AttributedNativeException, GovernedRun } from "../governance/governance.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { nativeDebtSitesOf } from "./native-debt-sites.ts";

const FILE = repoPathSchema.parse("src/a.ts");

const OTHER_FILE = repoPathSchema.parse("src/b.ts");

const ESLINT_RUN: GovernedRun = { mechanism: ESLINT, nativeExceptions: [], coverableKinds: ["config-override", "inline-disable"] };

const INLINE_DISABLE: AttributedNativeException = {
  kind: "inline-disable",
  mechanism: ESLINT,
  clause: CAST_EXPRESSIONS,
  file: FILE,
  line: 3,
  text: "// eslint-disable-next-line x",
  reach: "one-clause",
};

const CONFIG_OVERRIDE: AttributedNativeException = { kind: "config-override", mechanism: ESLINT, clause: CAST_EXPRESSIONS, file: OTHER_FILE };

const IGNORE: AttributedNativeException = { kind: "ignore", mechanism: ESLINT, clause: CAST_EXPRESSIONS, file: FILE };

const NAMED_IGNORE: AttributedNativeException = { ...IGNORE, check: "claimed-type#cast-expressions", file: OTHER_FILE };

const OPTION: AttributedNativeException = {
  kind: "command-line-option",
  mechanism: ESLINT,
  clause: CAST_EXPRESSIONS,
  location: repoPathSchema.parse("package.json"),
  script: "lint",
  option: "--no-inline-config",
  cause: { kind: "weakens-run" },
};

const UNRUN_MECHANISM_EXCEPTION: AttributedNativeException = { ...INLINE_DISABLE, mechanism: AUDIT };

describe("nativeDebtSitesOf", () => {
  it("names the check and file of each exception a run's records can hold, once each, in file order", () => {
    expect(nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [CONFIG_OVERRIDE, INLINE_DISABLE, INLINE_DISABLE], runs: [ESLINT_RUN] })).toEqual({
      recordable: [
        { address: "claimed-type#cast-expressions", file: FILE },
        { address: "claimed-type#cast-expressions", file: OTHER_FILE },
      ],
      unrecordable: [],
    });
  });

  it("names, by its kind, each exception no record can hold, with the check it names or else its clause", () => {
    expect(nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [OPTION, NAMED_IGNORE, IGNORE], runs: [ESLINT_RUN] })).toEqual({
      recordable: [],
      unrecordable: [
        { address: "CD-2#cast-expressions", file: "package.json", because: "command-line-option" },
        { address: "CD-2#cast-expressions", file: FILE, because: "ignore" },
        { address: "claimed-type#cast-expressions", file: OTHER_FILE, because: "ignore" },
      ],
    });
  });

  it("names an exception of a kind the run's records do not hold by its kind, whichever kind it is", () => {
    expect(nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [INLINE_DISABLE], runs: [{ ...ESLINT_RUN, coverableKinds: [] }] })).toEqual({
      recordable: [],
      unrecordable: [{ address: "CD-2#cast-expressions", file: FILE, because: "inline-disable" }],
    });
  });

  it("names an exception of a mechanism that did not run by its kind", () => {
    expect(nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [UNRUN_MECHANISM_EXCEPTION], runs: [ESLINT_RUN] })).toEqual({
      recordable: [],
      unrecordable: [{ address: "CD-2#cast-expressions", file: FILE, because: "inline-disable" }],
    });
  });

  it("names nothing when no exception is unrecorded", () => {
    expect(nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [], runs: [ESLINT_RUN] })).toEqual({ recordable: [], unrecordable: [] });
  });
});
