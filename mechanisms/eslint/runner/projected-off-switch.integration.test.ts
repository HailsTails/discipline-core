import { afterAll, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { createDefaultScratchFilesPort } from "../../../scripts/install-proof-ports.ts";
import { restoredFixtureRepositoriesOver } from "../../../tests/restored-fixture-repository.ts";
import { scratchRepositoriesUnder } from "../../../tests/scratch-repositories.ts";
import type { ExceptionRecord } from "../../../core/upgrade/version-one-records/exception-records.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { FIRST_EDITION } from "../../../core/values/edition.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { ESLINT_LINES, eslintRunnerOn } from "../../../tests/eslint-toolchains.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/mechanisms/eslint/CD-14`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

const restoredFixtures = restoredFixtureRepositoriesOver({ repositories, scratch, fileText, path: createDefaultPathPort({}) });

afterAll(() => {
  repositories.removeAll();
});

const ROUTE_FILES =[repoPathSchema.parse("route/[id].ts"), repoPathSchema.parse("route/i.ts")];

const ROUTE_RUN = {
  repoRoot: restoredFixtures.restoredFrom({ fixtureRoot: absolutePathSchema.parse(`${import.meta.dirname}/test-fixtures/route-brackets`) }),
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  files: ROUTE_FILES,
  trackedPaths: ROUTE_FILES,
  clauses: [ESLINT_CLAUSE],
};

const ROUTE_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLAUSE,
  mechanism: mechanismIdSchema.parse("eslint"),
  file: repoPathSchema.parse("route/[id].ts"),
  reason: "wrapping factory for a library construction",
};

describe.each(ESLINT_LINES)("real %s config resolution of the projection's own off-switch, over a consumer repository", (line) => {
  it("reports no config-override on the file a record projects off", async () => {
    await expect(eslintRunnerOn({ line }).run({ ...ROUTE_RUN, records: [ROUTE_LOCATION] })).resolves.toMatchObject({
      outcome: "ok",
      value: { nativeExceptions: [], projection: "current" },
    });
  });

  it("reports the same off-switch as a config-override once no record holds the file", async () => {
    await expect(eslintRunnerOn({ line }).run({ ...ROUTE_RUN, records: [] })).resolves.toMatchObject({
      outcome: "ok",
      value: { nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "route/[id].ts" }] },
    });
  });
});
