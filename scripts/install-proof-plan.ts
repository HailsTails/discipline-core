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

export type ConsumerFixture = "audit" | "eslint" | "team" | "workspace";

export type ProofAction =
  | { readonly kind: "check"; readonly expectation: StepExpectation }
  | { readonly kind: "project"; readonly expectation: StepExpectation }
  | { readonly kind: "commit"; readonly message: string }
  | { readonly kind: "read"; readonly path: string; readonly text: string }
  | { readonly kind: "typecheck"; readonly project: string; readonly expectation: StepExpectation }
  | { readonly kind: "lint"; readonly directory: string; readonly expectation: StepExpectation };

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
];

const AUDIT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output: "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
    },
  },
];

const ESLINT_MISSING_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: {
      exitCode: 2,
      output:
        "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.28.0 || ^10.0.0; @typescript-eslint/parser found not installed, supported ^8.56.0; @typescript-eslint/eslint-plugin found not installed, supported ^8.56.0: add a supported version of each to the devDependencies of the repository root\n",
    },
  },
];

const WORKSPACE_SLICE = `import piece0 from "${TOOL_IDENTITY.packageName}/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/file-records/CD-14#class-syntax",
    files: [
      "src/legacy.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const WORKSPACE_REPORT = `findings (1)
CD-14#class-syntax eslint packages/web/src/kept.ts:1:7 export class Kept {}
exempted (1)
CD-14#class-syntax eslint packages/web/src/legacy.ts:1:7 export class Legacy {} exempted by file-carve-out
uncovered (1)
CD-14#static-only-class
verdict: fail
`;

const WORKSPACE_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\npackages/web/disciplines.eslint.mjs written\n" },
  },
  { kind: "read", path: "packages/web/disciplines.eslint.mjs", text: WORKSPACE_SLICE },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output: WORKSPACE_REPORT,
    },
  },
  { kind: "lint", directory: "packages/web", expectation: { exitCode: 1, output: "src/kept.ts:1:8 hone/no-class-authoring\n" } },
];

const SILENT_SUCCESS: StepExpectation = { exitCode: 0, output: "" };

const WRONG_FIELD_TYPES_REJECTED: ProofAction = {
  kind: "typecheck",
  project: "typing/tsconfig.wrong.json",
  expectation: {
    exitCode: 2,
    output:
      "typing/wrong-piece-settings.mts(7,37): error TS2344: Type '{ pluginNamespace: string; pluginModule: string; rule: number; }' does not satisfy the constraint 'EslintPieceSettings'.\n  Types of property 'rule' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-piece.mts(16,27): error TS2345: Argument of type '{ clause: ClauseAddress; anchor: Anchor; snippet: number; }' is not assignable to parameter of type 'PieceHit'.\n  Types of property 'snippet' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-rule-set.mts(3,160): error TS2322: Type '\"lint\"' is not assignable to type '\"review\"'.\n",
  },
};

const TEAM_RULE_SET = "tools/disciplines/acme";

const TEAM_FINDINGS_REPORT = `findings (2)
acme/ACME-1#console-calls eslint src/start-banner.ts:1:0 console.log("web started");
acme/ACME-2#scratch-files audit notes.scratch.md:1:0 notes.scratch.md
verdict: fail
`;

const TEAM_FLOOR_ACTIONS: readonly ProofAction[] = [WRONG_FIELD_TYPES_REJECTED];

const TEAM_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: `${TEAM_RULE_SET}/tsconfig.pieces.json`, expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: `${TEAM_RULE_SET}/tsconfig.bundler.json`, expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: "typing/tsconfig.commonjs.json", expectation: SILENT_SUCCESS },
  WRONG_FIELD_TYPES_REJECTED,
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs unchanged\n" } },
  { kind: "check", expectation: { exitCode: 1, output: TEAM_FINDINGS_REPORT } },
];

export const PROOF_CASES: readonly ProofCase[] = [
  { consumer: "audit", fixture: "audit", toolchain: "typescript-floor", typeStripping: "disabled", actions: AUDIT_CONSUMER_ACTIONS },
  { consumer: "eslint-10", fixture: "eslint", toolchain: "eslint-10-floor", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-9", fixture: "eslint", toolchain: "eslint-9-floor", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-missing", fixture: "eslint", toolchain: "typescript-floor", typeStripping: "disabled", actions: ESLINT_MISSING_ACTIONS },
  { consumer: "team-floor", fixture: "team", toolchain: "typescript-floor", typeStripping: "disabled", actions: TEAM_FLOOR_ACTIONS },
  { consumer: "team", fixture: "team", toolchain: "current", typeStripping: "enabled", actions: TEAM_ACTIONS },
  { consumer: "workspace", fixture: "workspace", toolchain: "eslint-10-floor", typeStripping: "disabled", actions: WORKSPACE_ACTIONS },
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
