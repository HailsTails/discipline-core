import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema, ruleSetNameSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { DeclaredRuleSet } from "./settings-file.ts";
import { createSettingsSources } from "./settings-sources.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "..", ".."] }) });

const PAIR_ROOT = path.join({ segments: [INSTALL_ROOT, "tests", "test-fixtures", "settings-pair"] });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "after"] }) });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "before"] }) });

const AUDIT = mechanismIdSchema.parse("audit");

const sourcesAt = (request: { readonly repoRoot: AbsolutePath }) =>
  createSettingsSources({ repoRoot: request.repoRoot, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path });

describe("createSettingsSources", () => {
  it("reads hone.config.json at the repository root as a document, naming its path", () => {
    expect(sourcesAt({ repoRoot: AFTER_ROOT }).settingsFile({})).toMatchObject({
      outcome: "ok",
      value: { path: path.join({ segments: [AFTER_ROOT, "hone.config.json"] }), document: { version: 2, forfeiture: "elsewhere" } },
    });
  });

  it("names the repository when it has no hone.config.json", () => {
    expect(sourcesAt({ repoRoot: BEFORE_ROOT }).settingsFile({})).toEqual({ outcome: "failed", error: { kind: "selection-absent", repo: BEFORE_ROOT } });
  });

  it("finds Hone's own rule set at the install root and a declared one under the repository", () => {
    const sources = sourcesAt({ repoRoot: AFTER_ROOT });
    const ruleSets: readonly DeclaredRuleSet[] = [{ name: ruleSetNameSchema.parse("team"), location: { location: "folder", path: repoPathSchema.parse("tools/hone-rules") } }];
    expect({
      hone: sources.ruleSetRoot({ ruleSet: "hone", ruleSets }),
      team: sources.ruleSetRoot({ ruleSet: { name: ruleSetNameSchema.parse("team") }, ruleSets }),
    }).toEqual({
      hone: { outcome: "ok", value: INSTALL_ROOT },
      team: { outcome: "ok", value: resolvedPath({ path: path.join({ segments: [AFTER_ROOT, "tools/hone-rules"] }) }) },
    });
  });

  it("holds the symptom catalogue at Hone's install root and none where a rule set has none", () => {
    const sources = sourcesAt({ repoRoot: AFTER_ROOT });
    expect({ install: sources.catalogue({ ruleSetRoot: INSTALL_ROOT }), pair: sources.catalogue({ ruleSetRoot: AFTER_ROOT }) }).toMatchObject({
      install: { outcome: "ok", value: { held: "catalogue" } },
      pair: { outcome: "ok", value: { held: "none" } },
    });
  });

  it("reads the piece of a mechanical clause with its definition's anchor and exceptions", () => {
    expect(
      sourcesAt({ repoRoot: AFTER_ROOT }).pieceClause({ ruleSetRoot: INSTALL_ROOT, clause: clauseAddressSchema.parse("CD-15#loops"), mechanism: AUDIT }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        anchor: { kind: "file" },
        pieceRoot: path.join({ segments: [INSTALL_ROOT, "mechanisms", "audit", "CD-15"] }),
        settings: { module: "loops.ts" },
        declarations: {},
      },
    });
  });

  type RefusalRow = { readonly name: string; readonly clause: string; readonly mechanism: string; readonly refusal: unknown };

  it.each<RefusalRow>([
    { name: "a discipline the rule set lacks", clause: "CD-99#loops", mechanism: "audit", refusal: { kind: "unknown-discipline", address: "CD-99#loops" } },
    { name: "a clause its discipline lacks", clause: "CD-15#nothing", mechanism: "audit", refusal: { kind: "unknown-clause", address: "CD-15#nothing" } },
    {
      name: "a judgement clause",
      clause: "CD-13#layer-boundaries",
      mechanism: "audit",
      refusal: { kind: "judgement-clause-selected", address: "CD-13#layer-boundaries" },
    },
    {
      name: "a mechanism the clause does not allow",
      clause: "CD-15#loops",
      mechanism: "eslint",
      refusal: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: "eslint" },
    },
  ])("refuses $name", ({ clause, mechanism, refusal }) => {
    expect(
      sourcesAt({ repoRoot: AFTER_ROOT }).pieceClause({
        ruleSetRoot: INSTALL_ROOT,
        clause: clauseAddressSchema.parse(clause),
        mechanism: mechanismIdSchema.parse(mechanism),
      }),
    ).toEqual({ outcome: "failed", error: refusal });
  });
});
