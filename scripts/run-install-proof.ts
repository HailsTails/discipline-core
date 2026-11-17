import { z } from "zod";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import {
  type CommandScript,
  judgedStep,
  PACKAGED_CONSUMER_NPMRC,
  packagedScriptsOf,
  packagedConsumerManifest,
  type ProofAction,
  type ProofCase,
  type ProofToolchain,
  requiredPeerPinsOf,
  type StepRun,
  type TypeStripping,
  toolchainManifest,
} from "./install-proof-plan.ts";
import type { CommandRunPort, ProofCommand, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "./package-commands.ts";
import { packageFileStemOf, TOOL_IDENTITY } from "../core/values/tool-identity.ts";

export type InstallProofRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packer: TarballPackerPort;
  readonly moduleUrl: string;
  readonly proofCases: readonly ProofCase[];
};

type Step = () => Result<null, string>;

type ProofContext = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packageRoot: string;
};

const SUCCEEDED: Result<null, string> = { outcome: "ok", value: null };
const IGNORED_INSTALLS = "node_modules/\n";
const TEMPORARY_PREFIX = `${packageFileStemOf({ packageName: TOOL_IDENTITY.packageName })}-install-proof-`;
const GIT_IDENTITY = ["-c", "user.name=proof", "-c", "user.email=proof@invalid", "-c", "commit.gpgsign=false"];
const NPM_INSTALL = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
const NODE_MODULES = "node_modules";
const PASS_LINE = "install proof: pass\n";
const NPM_INSTALL_TARBALL = ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--save-dev"];
const NPM_RUN_SILENT = ["run", "--silent"];
const SOURCE_MODULE_SUFFIX = ".ts";
const DECLARATION_SUFFIX = ".d.ts";
const INSTALLED_TYPESCRIPT_COMPILER = "node_modules/typescript/bin/tsc";
const TYPECHECK_ONLY = ["--noEmit", "-p"];
const PLATFORM_LINE_END = "\r\n";
const NPM_CONFIG = ".npmrc";
const inOrder = (request: { readonly steps: readonly Step[] }): Result<null, string> =>
  request.steps.reduce<Result<null, string>>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), SUCCEEDED);

const labelled = <T>(request: {
  readonly label: string;
  readonly result: Result<T, { readonly detail: string }>;
}): Result<T, string> =>
  request.result.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: ${request.label}: ${request.result.error.detail}` }
    : request.result;

const emptied = (request: { readonly result: Result<unknown, string> }): Result<null, string> =>
  request.result.outcome === "failed" ? request.result : SUCCEEDED;

const succeededRun = (request: { readonly label: string; readonly run: StepRun }): Result<null, string> => {
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === 0
    ? SUCCEEDED
    : { outcome: "failed", error: `FAIL: ${request.label}: exit ${request.run.exitCode}\n${request.run.output}` };
};

const ranCommand = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly command: ProofCommand;
  readonly arguments: readonly string[];
  readonly directory: string;
}): Result<null, string> =>
  succeededRun({
    label: request.label,
    run: request.context.commands.run({
      command: request.command,
      arguments: request.arguments,
      directory: request.directory,
    }),
  });

const git = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly arguments: readonly string[];
}): Result<null, string> =>
  ranCommand({
    context: request.context,
    label: `git ${request.arguments.join(" ")} in ${request.consumer}`,
    command: "git",
    arguments: [...GIT_IDENTITY, ...request.arguments],
    directory: request.repo,
  });

const commitAll = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly message: string;
}): Result<null, string> =>
  inOrder({
    steps: [
      () => git({ ...request, arguments: ["add", "-A"] }),
      () => git({ ...request, arguments: ["commit", "-q", "-m", request.message] }),
    ],
  });

const commandRun = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
}): StepRun =>
  request.context.commands.run({
    command: "npm",
    arguments: [...NPM_RUN_SILENT, packagedScriptsOf({ identity: TOOL_IDENTITY })[request.script], ...(request.arguments.length === 0 ? [] : ["--", ...request.arguments])],
    directory: request.repo,
  });

const installedCommand = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly label: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
}): Result<null, string> => {
  const judged = judgedStep({ label: request.label, expectation: request.action.expectation, run: commandRun(request) });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const withLineFeeds = (request: { readonly run: StepRun }): StepRun =>
  request.run.outcome === "exited"
    ? { ...request.run, output: request.run.output.replaceAll(PLATFORM_LINE_END, "\n") }
    : request.run;

const typeCheckedProject = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: Extract<ProofAction, { readonly kind: "typecheck" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: `${request.consumer} tsc -p ${request.action.project}`,
    expectation: request.action.expectation,
    run: withLineFeeds({
      run: request.context.commands.run({
        command: "node",
        arguments: [INSTALLED_TYPESCRIPT_COMPILER, ...TYPECHECK_ONLY, request.action.project],
        directory: request.repo,
      }),
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const readExactly = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}): Result<null, string> => {
  const read = labelled({ label: request.label, result: request.context.fileText.read({ path: request.path }) });
  if (read.outcome === "failed") {
    return read;
  }
  if (read.value !== request.text) {
    return {
      outcome: "failed",
      error: `FAIL: ${request.label}: expected ${JSON.stringify(request.text)}, but it reads ${JSON.stringify(read.value)}`,
    };
  }
  request.context.process.writeOut({ text: `ok: ${request.label} reads exactly as expected\n` });
  return SUCCEEDED;
};

const performedAction = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: ProofAction;
}): Result<null, string> => {
  const action = request.action;
  switch (action.kind) {
    case "check":
      return installedCommand({
        ...request,
        label: `${request.consumer} check`,
        script: "check",
        arguments: ["--base-revision", "HEAD"],
        action,
      });
    case "project":
      return installedCommand({ ...request, label: `${request.consumer} project`, script: "project", arguments: [], action });
    case "commit":
      return commitAll({ context: request.context, repo: request.repo, consumer: request.consumer, message: action.message });
    case "read":
      return readExactly({
        context: request.context,
        label: `${request.consumer} ${action.path}`,
        path: request.context.path.join({ segments: [request.repo, action.path] }),
        text: action.text,
      });
    case "typecheck":
      return typeCheckedProject({ context: request.context, repo: request.repo, consumer: request.consumer, action });
  }
};

const writtenFile = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}): Result<null, string> =>
  emptied({
    result: labelled({ label: request.label, result: request.context.fileText.write({ path: request.path, text: request.text }) }),
  });

type ConsumerFile = { readonly name: string; readonly text: string };

const NPM_CONFIG_FILES: Readonly<Record<TypeStripping, readonly ConsumerFile[]>> = {
  disabled: [{ name: NPM_CONFIG, text: PACKAGED_CONSUMER_NPMRC }],
  enabled: [],
};

const consumerFiles = (request: {
  readonly requiredPeers: Readonly<Record<string, string>>;
  readonly typeStripping: TypeStripping;
}): readonly ConsumerFile[] => [
  { name: "package.json", text: packagedConsumerManifest({ identity: TOOL_IDENTITY, requiredPeers: request.requiredPeers }) },
  { name: ".gitignore", text: IGNORED_INSTALLS },
  ...NPM_CONFIG_FILES[request.typeStripping],
];

const installedVersionSchema = z.object({ version: z.string() });
const preparedConsumer = (request: {
  readonly context: ProofContext;
  readonly fixture: string;
  readonly repo: string;
  readonly files: readonly ConsumerFile[];
}): Result<null, string> => {
  const label = `prepare the consumer ${request.repo}`;
  return inOrder({
    steps: [
      () =>
        labelled({
          label,
          result: request.context.scratch.copyTree({ from: request.fixture, to: request.repo, disposition: () => "kept" }),
        }),
      ...request.files.map(
        (file): Step =>
          () =>
            writtenFile({
              context: request.context,
              label,
              path: request.context.path.join({ segments: [request.repo, file.name] }),
              text: file.text,
            }),
      ),
    ],
  });
};

const installedToolchain = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<null, string> => {
  const manifest = toolchainManifest({ developmentManifest: request.packageManifest, toolchain: request.toolchain });
  if (manifest.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: package.json: ${manifest.error.detail}` };
  }
  const directory = request.context.path.join({ segments: [request.temporaryRoot, request.toolchain] });
  const label = `prepare the ${request.toolchain} toolchain`;
  return inOrder({
    steps: [
      () => emptied({ result: labelled({ label, result: request.context.scratch.makeDirectory({ path: directory }) }) }),
      () =>
        writtenFile({
          context: request.context,
          label,
          path: request.context.path.join({ segments: [directory, "package.json"] }),
          text: manifest.value,
        }),
      () =>
        ranCommand({
          context: request.context,
          label: `npm install the ${request.toolchain} toolchain`,
          command: "npm",
          arguments: NPM_INSTALL,
          directory,
        }),
    ],
  });
};

type CaseRequest = {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly tarball: string;
  readonly proofCase: ProofCase;
};

const consumerRepo = (request: CaseRequest): string =>
  request.context.path.join({ segments: [request.temporaryRoot, request.proofCase.toolchain, request.proofCase.consumer] });

const consumerFixture = (request: CaseRequest): string =>
  request.context.path.join({
    segments: [request.context.packageRoot, "tests", "test-fixtures", "consumer-proof", request.proofCase.fixture],
  });
const packageShipsNoSource = (request: {
  readonly context: ProofContext;
  readonly consumer: string;
  readonly installedPackage: string;
}): Result<null, string> => {
  const label = `${request.consumer} installed package holds no TypeScript source to strip`;
  const listed = labelled({ label, result: request.context.scratch.listTree({ path: request.installedPackage }) });
  if (listed.outcome === "failed") {
    return listed;
  }
  const sources = listed.value.filter(
    (entry) => entry.entryKind === "file" && entry.name.endsWith(SOURCE_MODULE_SUFFIX) && !entry.name.endsWith(DECLARATION_SUFFIX),
  );
  const modules = listed.value.filter((entry) => entry.entryKind === "file" && entry.name.endsWith(".js"));
  if (sources.length > 0 || modules.length === 0) {
    return {
      outcome: "failed",
      error: `FAIL: ${label}: found ${sources.length} .ts and ${modules.length} .js files under ${request.installedPackage}`,
    };
  }
  request.context.process.writeOut({ text: `ok: ${label}\n` });
  return SUCCEEDED;
};

const installedVersionOf = (request: { readonly context: ProofContext; readonly manifest: string }): Result<string, string> => {
  const text = request.context.fileText.read({ path: request.manifest });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: text.error.detail };
  }
  const parsed = parsedJson({ text: text.value });
  const installed = parsed.outcome === "failed" ? undefined : installedVersionSchema.safeParse(parsed.value);
  return installed?.success === true ? { outcome: "ok", value: installed.data.version } : { outcome: "failed", error: `${request.manifest} names no version` };
};

const requiredPeerAtFloor = (request: {
  readonly context: ProofContext;
  readonly consumer: string;
  readonly repo: string;
  readonly peer: string;
  readonly floor: string;
}): Result<null, string> => {
  const label = `${request.consumer} resolves the required peer ${request.peer} at its pinned version ${request.floor}`;
  const manifest = request.context.path.join({ segments: [request.repo, NODE_MODULES, ...request.peer.split("/"), "package.json"] });
  const installed = installedVersionOf({ context: request.context, manifest });
  if (installed.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: ${label}: ${installed.error}` };
  }
  if (installed.value !== request.floor) {
    return { outcome: "failed", error: `FAIL: ${label}: found ${installed.value}` };
  }
  request.context.process.writeOut({ text: `ok: ${label}\n` });
  return SUCCEEDED;
};

const provenCase = (request: CaseRequest): Result<null, string> => {
  const pins = requiredPeerPinsOf({ developmentManifest: request.packageManifest, toolchain: request.proofCase.toolchain });
  if (pins.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: package.json: ${pins.error.detail}` };
  }
  const context = request.context;
  const consumer = request.proofCase.consumer;
  const repo = consumerRepo(request);
  return inOrder({
    steps: [
      () =>
        preparedConsumer({
          context,
          fixture: consumerFixture(request),
          repo,
          files: consumerFiles({ requiredPeers: pins.value, typeStripping: request.proofCase.typeStripping }),
        }),
      () =>
        ranCommand({
          context,
          label: `npm install the packed tarball into ${consumer}`,
          command: "npm",
          arguments: [...NPM_INSTALL_TARBALL, request.tarball],
          directory: repo,
        }),
      () =>
        packageShipsNoSource({
          context,
          consumer,
          installedPackage: context.path.join({ segments: [repo, NODE_MODULES, ...TOOL_IDENTITY.packageName.split("/")] }),
        }),
      ...Object.entries(pins.value).map(
        ([peer, floor]): Step =>
          () =>
            requiredPeerAtFloor({ context, consumer, repo, peer, floor }),
      ),
      () => git({ context, repo, consumer, arguments: ["init", "-q"] }),
      () => commitAll({ context, repo, consumer, message: "consumer" }),
      ...request.proofCase.actions.map(
        (action): Step =>
          () =>
            performedAction({ context, repo, consumer, action }),
      ),
    ],
  });
};

const toolchainsOf = (request: { readonly proofCases: readonly ProofCase[] }): readonly ProofToolchain[] => [
  ...new Set(request.proofCases.map((proofCase) => proofCase.toolchain)),
];

const provenInside = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly tarball: string;
  readonly proofCases: readonly ProofCase[];
}): Result<null, string> =>
  inOrder({
    steps: [
      ...toolchainsOf(request).map(
        (toolchain): Step =>
          () =>
            installedToolchain({ ...request, toolchain }),
      ),
      ...request.proofCases.map(
        (proofCase): Step =>
          () =>
            provenCase({ ...request, proofCase }),
      ),
    ],
  });

const provenWithTarball = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const tarball = await request.packer.pack({ packageRoot: request.context.packageRoot, workRoot: request.temporaryRoot });
  return tarball.outcome === "failed" ? tarball : provenInside({ ...request, tarball: tarball.value });
};

const provenWithin = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly packageManifest: string;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const temporaryRoot = labelled({
    label: "create the temporary consumer root",
    result: request.context.scratch.createTemporaryDirectory({ prefix: TEMPORARY_PREFIX }),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  const proven = await provenWithTarball({ ...request, temporaryRoot: temporaryRoot.value });
  const removed = labelled({
    label: "remove the temporary consumer root",
    result: request.context.scratch.removeTree({ path: temporaryRoot.value }),
  });
  return proven.outcome === "failed" ? proven : removed;
};
const packageRootOf = (request: { readonly path: PathPort; readonly moduleUrl: string }): Result<string, string> => {
  const entryPath = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entryPath.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: locate the package root: ${entryPath.error.detail}` };
  }
  return {
    outcome: "ok",
    value: request.path.directoryOf({ path: request.path.directoryOf({ path: entryPath.value }) }),
  };
};

const readPackageFile = (request: { readonly context: ProofContext; readonly name: string }): Result<string, string> =>
  labelled({
    label: `read ${request.name}`,
    result: request.context.fileText.read({
      path: request.context.path.join({ segments: [request.context.packageRoot, request.name] }),
    }),
  });

const proof = (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const packageManifest = readPackageFile({ context: request.context, name: "package.json" });
  if (packageManifest.outcome === "failed") {
    return Promise.resolve(packageManifest);
  }
  return provenWithin({
    context: request.context,
    packer: request.packer,
    packageManifest: packageManifest.value,
    proofCases: request.proofCases,
  });
};
const proofOutcome = (request: InstallProofRequest): Promise<Result<null, string>> => {
  const packageRoot = packageRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (packageRoot.outcome === "failed") {
    return Promise.resolve(packageRoot);
  }
  return proof({
    packer: request.packer,
    context: {
      process: request.process,
      path: request.path,
      fileText: request.fileText,
      scratch: request.scratch,
      commands: request.commands,
      packageRoot: packageRoot.value,
    },
    proofCases: request.proofCases,
  });
};

export const runInstallProof = async (request: InstallProofRequest): Promise<void> => {
  const outcome = await proofOutcome(request);
  if (outcome.outcome === "failed") {
    request.process.writeOut({ text: `${outcome.error}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeOut({ text: PASS_LINE });
  request.process.exitWith({ code: 0 });
};
