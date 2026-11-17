import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import { TOOL_IDENTITY, type ToolIdentity } from "../core/values/tool-identity.ts";
import { peerKindsOf } from "./published-manifest.ts";

export type EntryKind = "folder" | "file";

export type EntryDisposition = "left-out" | "kept";

export type StepExpectation = { readonly exitCode: number; readonly output: string };

export type StepRun =
  | { readonly outcome: "exited"; readonly exitCode: number; readonly output: string }
  | { readonly outcome: "not-exited"; readonly detail: string };

export type ConsumerFixture = "audit" | "eslint" | "typed-team-piece" | "team-monorepo";

export type ProofAction =
  | { readonly kind: "check"; readonly expectation: StepExpectation }
  | { readonly kind: "project"; readonly expectation: StepExpectation }
  | { readonly kind: "remove"; readonly path: string }
  | { readonly kind: "commit"; readonly message: string }
  | { readonly kind: "read"; readonly path: string; readonly text: string }
  | { readonly kind: "write"; readonly path: string; readonly text: string }
  | { readonly kind: "restore"; readonly path: string }
  | { readonly kind: "execute"; readonly path: string; readonly expectation: StepExpectation }
  | { readonly kind: "typecheck"; readonly project: string; readonly expectation: StepExpectation };

export type ProofToolchain = "typescript-floor" | "current" | "eslint-9-floor" | "eslint-10-floor";

export type TypeStripping = "disabled" | "enabled";

export type CommandScript = "check" | "project";

export type ProofCase = {
  readonly consumer: string;
  readonly fixture: ConsumerFixture;
  readonly toolchain: ProofToolchain;
  readonly typeStripping: TypeStripping;
  readonly actions: readonly ProofAction[];
};

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const PASSING_REPORT = "verdict: pass\n";

const ESLINT_PROJECTION = `import piece0 from "${TOOL_IDENTITY.packageName}/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
];
`;

const ESLINT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\n" } },
  { kind: "read", path: "disciplines.eslint.mjs", text: ESLINT_PROJECTION },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: { exitCode: 1, output: "findings (1)\nCD-14#class-syntax eslint src/kept.ts:1:7 export class Kept {}\nverdict: fail\n" },
  },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: PASSING_REPORT } },
];

const AUDIT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output: "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
    },
  },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: PASSING_REPORT } },
  { kind: "project", expectation: { exitCode: 0, output: "" } },
];

const ESLINT_MISSING_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: {
      exitCode: 2,
      output:
        "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.28.0 || ^10.0.0: add a supported version to the devDependencies of the repository root\n",
    },
  },
];

const SILENT_SUCCESS: StepExpectation = { exitCode: 0, output: "" };

const WRONG_FIELD_TYPES_REJECTED: ProofAction = {
  kind: "typecheck",
  project: "tsconfig.wrong.json",
  expectation: {
    exitCode: 2,
    output:
      "src/wrong-piece.mts(16,27): error TS2345: Argument of type '{ clause: ClauseAddress; anchor: Anchor; snippet: number; }' is not assignable to parameter of type 'PieceHit'.\n  Types of property 'snippet' are incompatible.\n    Type 'number' is not assignable to type 'string'.\nsrc/wrong-rule-set.mts(3,160): error TS2322: Type '\"lint\"' is not assignable to type '\"review\"'.\n",
  },
};

const TYPED_FLOOR_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: "tsconfig.nodenext.json", expectation: SILENT_SUCCESS },
  WRONG_FIELD_TYPES_REJECTED,
];

const TYPED_CURRENT_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: "tsconfig.nodenext.json", expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: "tsconfig.bundler.json", expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: "tsconfig.commonjs.json", expectation: SILENT_SUCCESS },
  WRONG_FIELD_TYPES_REJECTED,
];

const TEAM_RULE_SET = "tools/disciplines/acme";

const CONSOLE_FINDINGS = [
  'acme/ACME-1#console-calls eslint packages/api/src/request-trace.ts:1:0 console.error("request received");',
  'acme/ACME-1#console-calls eslint packages/web/src/start-banner.ts:1:0 console.log("web started");',
];

const SCRATCH_NOTE_FINDING = "acme/ACME-2#scratch-files audit packages/api/notes.scratch.md:1:0 packages/api/notes.scratch.md";

const SCRATCH_SOURCE_FINDING = "acme/ACME-2#scratch-files audit packages/web/src/layout.scratch.ts:1:0 packages/web/src/layout.scratch.ts";

const TEAM_FINDINGS = [...CONSOLE_FINDINGS, SCRATCH_NOTE_FINDING, SCRATCH_SOURCE_FINDING];

const TEAM_VIOLATIONS = ["packages/api/src/request-trace.ts", "packages/web/src/start-banner.ts", "packages/api/notes.scratch.md", "packages/web/src/layout.scratch.ts"];

const WEB_CONFIG = "packages/web/eslint.config.mjs";

const WEB_CONFIG_WITHOUT_PROJECTION = 'export default [\n  { files: ["src/**/*.ts"] },\n];\n';

const WEB_CONFIG_OVERRIDES = ["layout.scratch.ts", "start-banner.ts"].map(
  (file) => `acme/ACME-1#console-calls eslint config-override packages/web/src/${file}`,
);

const SELECTION = "disciplines.json";

const SELECTION_CLAIMING_HONE = `{
  "version": 1,
  "ruleSets": { "hone": "${TEAM_RULE_SET}" },
  "clauses": {
    "hone/ACME-1#console-calls": "eslint",
    "hone/ACME-2#scratch-files": "audit",
    "hone/CD-15#loops": "audit"
  }
}
`;

const SELECTION_MARKING_NOTES_ONLY = `{
  "version": 1,
  "ruleSets": { "acme": "${TEAM_RULE_SET}" },
  "clauses": {
    "acme/ACME-1#console-calls": "eslint",
    "acme/ACME-2#scratch-files": "audit",
    "hone/CD-15#loops": "audit"
  },
  "clauseSettings": {
    "acme/ACME-2#scratch-files": { "marker": ".scratch.md" }
  }
}
`;

const reportOf = (request: { readonly sections: readonly (readonly [string, readonly string[]])[]; readonly verdict: "pass" | "fail" }): string =>
  `${request.sections.map(([name, lines]) => `${name} (${lines.length})\n${lines.map((line) => `${line}\n`).join("")}`).join("")}verdict: ${request.verdict}\n`;

const TEAM_MONOREPO_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs unchanged\n" } },
  { kind: "typecheck", project: `${TEAM_RULE_SET}/tsconfig.pieces.json`, expectation: SILENT_SUCCESS },
  { kind: "execute", path: `${TEAM_RULE_SET}/mechanisms/eslint/ACME-1/acme.eslint-plugin.test.ts`, expectation: SILENT_SUCCESS },
  { kind: "check", expectation: { exitCode: 1, output: reportOf({ sections: [["findings", TEAM_FINDINGS]], verdict: "fail" }) } },
  { kind: "write", path: WEB_CONFIG, text: WEB_CONFIG_WITHOUT_PROJECTION },
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output: reportOf({ sections: [["findings", TEAM_FINDINGS], ["unrecorded", WEB_CONFIG_OVERRIDES]], verdict: "fail" }),
    },
  },
  { kind: "restore", path: WEB_CONFIG },
  { kind: "write", path: SELECTION, text: SELECTION_MARKING_NOTES_ONLY },
  {
    kind: "check",
    expectation: { exitCode: 1, output: reportOf({ sections: [["findings", [...CONSOLE_FINDINGS, SCRATCH_NOTE_FINDING]]], verdict: "fail" }) },
  },
  { kind: "write", path: SELECTION, text: SELECTION_CLAIMING_HONE },
  { kind: "check", expectation: { exitCode: 2, output: `load failure: reserved-rule-set-name ${TOOL_IDENTITY.ownRuleSet}\n` } },
  { kind: "restore", path: SELECTION },
  ...TEAM_VIOLATIONS.map((path): ProofAction => ({ kind: "remove", path })),
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: PASSING_REPORT } },
];

export const PROOF_CASES: readonly ProofCase[] = [
  { consumer: "audit", fixture: "audit", toolchain: "typescript-floor", typeStripping: "disabled", actions: AUDIT_CONSUMER_ACTIONS },
  { consumer: "eslint-10", fixture: "eslint", toolchain: "eslint-10-floor", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-9", fixture: "eslint", toolchain: "eslint-9-floor", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-missing", fixture: "eslint", toolchain: "typescript-floor", typeStripping: "disabled", actions: ESLINT_MISSING_ACTIONS },
  { consumer: "typed-floor", fixture: "typed-team-piece", toolchain: "typescript-floor", typeStripping: "disabled", actions: TYPED_FLOOR_ACTIONS },
  { consumer: "typed-current", fixture: "typed-team-piece", toolchain: "current", typeStripping: "disabled", actions: TYPED_CURRENT_ACTIONS },
  { consumer: "team-monorepo", fixture: "team-monorepo", toolchain: "current", typeStripping: "enabled", actions: TEAM_MONOREPO_ACTIONS },
];

export const packagedScriptsOf = (request: { readonly identity: ToolIdentity }): Readonly<Record<CommandScript, string>> => ({
  check: `${request.identity.command}:check`,
  project: `${request.identity.command}:project`,
});

export const PACKAGED_CONSUMER_NPMRC = "node-options=--no-experimental-strip-types\n";

export const packagedConsumerManifest = (request: {
  readonly identity: ToolIdentity;
  readonly requiredPeers: Readonly<Record<string, string>>;
}): string =>
  `${JSON.stringify(
    {
      private: true,
      type: "commonjs",
      scripts: {
        [packagedScriptsOf(request).check]: `${request.identity.command} check --repo .`,
        [packagedScriptsOf(request).project]: `${request.identity.command} project --repo .`,
      },
      devDependencies: request.requiredPeers,
    },
    null,
    2,
  )}\n`;

export const judgedStep = (request: {
  readonly label: string;
  readonly expectation: StepExpectation;
  readonly run: StepRun;
}): Result<string, string> => {
  const expected = `expected exit ${request.expectation.exitCode} and output ${JSON.stringify(request.expectation.output)}`;
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: ${expected}, but it did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === request.expectation.exitCode && request.run.output === request.expectation.output
    ? { outcome: "ok", value: `ok: ${request.label} -> exit ${request.run.exitCode}, output exactly as expected` }
    : {
        outcome: "failed",
        error: `FAIL: ${request.label}: ${expected}, got exit ${request.run.exitCode} and output ${JSON.stringify(request.run.output)}`,
      };
};
const toolchainManifestSchema = z.object({
  peerDependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
});

type ToolchainManifest = z.output<typeof toolchainManifestSchema>;

type FloorPins = Readonly<Record<string, string>>;

const TYPESCRIPT_FLOOR: FloorPins = { typescript: "typescript-floor" };

const CURRENT: FloorPins = {
  typescript: "typescript",
  eslint: "eslint",
  "@typescript-eslint/parser": "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin": "@typescript-eslint/eslint-plugin",
};

const TYPESCRIPT_ESLINT_FLOOR: FloorPins = {
  ...TYPESCRIPT_FLOOR,
  "@typescript-eslint/parser": "typescript-eslint-parser-floor",
  "@typescript-eslint/eslint-plugin": "typescript-eslint-plugin-floor",
};

const FLOOR_PINS: Readonly<Record<ProofToolchain, FloorPins>> = {
  "typescript-floor": TYPESCRIPT_FLOOR,
  current: CURRENT,
  "eslint-9-floor": { ...TYPESCRIPT_ESLINT_FLOOR, eslint: "eslint-9-floor" },
  "eslint-10-floor": { ...TYPESCRIPT_ESLINT_FLOOR, eslint: "eslint-10-floor" },
};

const manifestInvalid = (request: { readonly detail: string }): Result<never, ManifestFailure> => ({
  outcome: "failed",
  error: { kind: "manifest-invalid", detail: request.detail },
});

const floorVersion = (request: {
  readonly manifest: ToolchainManifest;
  readonly peer: string;
  readonly pinName: string;
}): Result<string, ManifestFailure> => {
  const pin = request.manifest.devDependencies[request.pinName];
  if (pin === undefined) {
    return manifestInvalid({ detail: `no development pin ${request.pinName} for the peer ${request.peer}` });
  }
  const aliasPrefix = `npm:${request.peer}@`;
  const aliasedPin = request.pinName === request.peer ? `${aliasPrefix}${pin}` : pin;
  if (!aliasedPin.startsWith(aliasPrefix)) {
    return manifestInvalid({ detail: `the development pin ${request.pinName} is ${pin}, not an alias of ${request.peer}` });
  }
  return request.peer in request.manifest.peerDependencies
    ? { outcome: "ok", value: aliasedPin.slice(aliasPrefix.length) }
    : manifestInvalid({ detail: `${request.peer} is not a declared peer` });
};

const floorVersions = (request: {
  readonly manifest: ToolchainManifest;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> =>
  Object.entries(FLOOR_PINS[request.toolchain]).reduce<Result<FloorPins, ManifestFailure>>((sofar, [peer, pinName]) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const version = floorVersion({ manifest: request.manifest, peer, pinName });
    return version.outcome === "failed" ? version : { outcome: "ok", value: { ...sofar.value, [peer]: version.value } };
  }, { outcome: "ok", value: {} });

const floorPinsOf = (request: {
  readonly developmentManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return manifestInvalid({ detail: parsed.error });
  }
  const manifest = toolchainManifestSchema.safeParse(parsed.value);
  return manifest.success
    ? floorVersions({ manifest: manifest.data, toolchain: request.toolchain })
    : manifestInvalid({ detail: manifest.error.message });
};

export const requiredPeerPinsOf = (request: {
  readonly developmentManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> => {
  const pins = floorPinsOf(request);
  if (pins.outcome === "failed") {
    return pins;
  }
  const kinds = peerKindsOf({ developmentManifest: request.developmentManifest });
  return kinds.outcome === "failed"
    ? kinds
    : { outcome: "ok", value: Object.fromEntries(Object.entries(pins.value).filter(([peer]) => kinds.value[peer] === "required")) };
};

export const toolchainManifest = (request: {
  readonly developmentManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<string, ManifestFailure> => {
  const versions = floorPinsOf(request);
  return versions.outcome === "failed"
    ? versions
    : { outcome: "ok", value: `${JSON.stringify({ private: true, devDependencies: versions.value }, null, 2)}\n` };
};

export const environmentWithoutGit = (request: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(Object.entries(request.environment).filter(([name]) => !name.startsWith("GIT_")));
