import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { TypeStripping } from "../platform-ports/type-stripping-port.ts";
import type { LoadFailure } from "./load-failure.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { projectionRefusalOf, typeStrippingGuarded } from "./type-stripping-guard.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const stripping = (state: TypeStripping) => ({ state: () => state });

const REPAIR_LINE =
  "load failure: projection-needs-type-stripping eslintProjection chooses typescript, and this Node.js runs with type stripping turned off, so it cannot load the projection: run Hone without --no-experimental-strip-types, or set eslintProjection to javascript and run project again\n";

const selectionFile = (text: string): FileTextPort => ({
  read: () => ({ outcome: "ok", value: text }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
});

const commandOver = (request: { readonly fileText: FileTextPort; readonly arguments: readonly string[] }): CommandRequest => ({
  process: {
    arguments: request.arguments,
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  },
  path: posixPath,
  fileText: request.fileText,
  modules: { load: vi.fn() },
  git: { trackedPaths: vi.fn<GitPort["trackedPaths"]>(), changedSince: vi.fn<GitPort["changedSince"]>(), contentInBase: vi.fn<GitPort["contentInBase"]>(), textInBase: vi.fn<GitPort["textInBase"]>() },
  exceptionRepositoryOf: vi.fn(),
  moduleUrl: "file:///repo/node_modules/@hailstails/hone/core/check/tool-command.ts",
});

const TYPESCRIPT_SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": {}, "eslintProjection": "typescript" }';

const JAVASCRIPT_SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": {} }';

type RefusalRow = {
  readonly name: string;
  readonly eslintProjection: "javascript" | "typescript" | undefined;
  readonly state: TypeStripping;
  readonly refusal: LoadFailure | undefined;
};

const REFUSAL_ROWS: readonly RefusalRow[] = [
  { name: "the TypeScript projection on a Node.js that keeps types", eslintProjection: "typescript", state: "keeps-types", refusal: { kind: "projection-needs-type-stripping" } },
  { name: "the TypeScript projection on a Node.js that strips types", eslintProjection: "typescript", state: "strips-types", refusal: undefined },
  { name: "the JavaScript projection on a Node.js that keeps types", eslintProjection: "javascript", state: "keeps-types", refusal: undefined },
  { name: "no readable projection on a Node.js that keeps types", eslintProjection: undefined, state: "keeps-types", refusal: undefined },
];

describe("projectionRefusalOf", () => {
  it.each(REFUSAL_ROWS)("for $name the refusal is $refusal", (row) => {
    expect(projectionRefusalOf({ eslintProjection: row.eslintProjection, typeStripping: stripping(row.state) })).toEqual(row.refusal);
  });
});

describe("typeStrippingGuarded", () => {
  it("prints projection-needs-type-stripping and exits 2 without running the command when disciplines.json chooses the TypeScript projection on a Node.js that keeps types", async () => {
    const handler = vi.fn<(request: CommandRequest) => Promise<void>>();
    const command = commandOver({ fileText: selectionFile(TYPESCRIPT_SELECTION), arguments: ["--repo", "/repo"] });

    await typeStrippingGuarded({ handler, typeStripping: stripping("keeps-types") })(command);

    expect({ handled: handler.mock.calls, out: vi.mocked(command.process.writeOut).mock.calls, exits: vi.mocked(command.process.exitWith).mock.calls }).toEqual({
      handled: [],
      out: [[{ text: REPAIR_LINE }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("runs the command when the TypeScript projection is chosen and this Node.js strips types", async () => {
    const handler = vi.fn<(request: CommandRequest) => Promise<void>>().mockResolvedValue(undefined);
    const command = commandOver({ fileText: selectionFile(TYPESCRIPT_SELECTION), arguments: ["--repo", "/repo"] });

    await typeStrippingGuarded({ handler, typeStripping: stripping("strips-types") })(command);

    expect(handler).toHaveBeenCalledExactlyOnceWith(command);
  });

  it("runs the command when disciplines.json chooses the JavaScript projection on a Node.js that keeps types", async () => {
    const handler = vi.fn<(request: CommandRequest) => Promise<void>>().mockResolvedValue(undefined);
    const command = commandOver({ fileText: selectionFile(JAVASCRIPT_SELECTION), arguments: ["--repo", "/repo"] });

    await typeStrippingGuarded({ handler, typeStripping: stripping("keeps-types") })(command);

    expect(handler).toHaveBeenCalledExactlyOnceWith(command);
  });

  it("leaves a command with arguments it cannot read to report them itself", async () => {
    const handler = vi.fn<(request: CommandRequest) => Promise<void>>().mockResolvedValue(undefined);
    const command = commandOver({ fileText: selectionFile(TYPESCRIPT_SELECTION), arguments: ["--bogus", "x"] });

    await typeStrippingGuarded({ handler, typeStripping: stripping("keeps-types") })(command);

    expect(handler).toHaveBeenCalledExactlyOnceWith(command);
  });
});
