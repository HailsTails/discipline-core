import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { overlaidFileText } from "../../../tests/overlaid-file-text.ts";
import type { EslintPort, IgnoredState, QueryInstance } from "./eslint-instance.ts";
import { ignoredRootsOf } from "./ignored-roots.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const noFiles: FileTextPort = {
  read: ({ path: requested }) => ({ outcome: "failed", error: { kind: "unreadable", path: requested, detail: "absent" } }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const queryAnswering = (state: IgnoredState): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValue({ outcome: "ok", value: state }),
  ruleState: vi.fn<QueryInstance["ruleState"]>(),
});

const eslintGovernedBy = (query: QueryInstance): EslintPort => ({
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(query),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
});

const ignoredAmong = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly eslint: EslintPort;
  readonly packages: readonly string[];
  readonly candidates: readonly string[];
}) =>
  ignoredRootsOf({
    ports: { fileText: overlaidFileText({ base: noFiles, files: request.files }), path, eslint: request.eslint },
    repoRoot: REPO,
    packages: new Set(request.packages),
    candidates: repoPathSchema.array().parse(request.candidates),
  }).then((ignored) => [...ignored]);

const ROOT_AND_FIXTURE = { "/repo/eslint.config.mjs": "", "/repo/fixtures/broken/eslint.config.mjs": "" };

describe("ignoredRootsOf", () => {
  it("names a config root whose folder the repository root's config ignores, asking it about the root's own config file", async () => {
    const rootQuery = queryAnswering("ignored");
    await expect(
      ignoredAmong({
        files: ROOT_AND_FIXTURE,
        eslint: eslintGovernedBy(rootQuery),
        packages: ["fixtures/broken"],
        candidates: ["fixtures/broken"],
      }),
    ).resolves.toEqual(["fixtures/broken"]);
    expect(rootQuery.ignoredState).toHaveBeenCalledWith({ file: "fixtures/broken/eslint.config.mjs" });
  });

  it("leaves out a config root its governing configs check", async () => {
    await expect(
      ignoredAmong({
        files: ROOT_AND_FIXTURE,
        eslint: eslintGovernedBy(queryAnswering("checked")),
        packages: ["fixtures/broken"],
        candidates: ["fixtures/broken"],
      }),
    ).resolves.toEqual([]);
  });

  it("names a config root an enclosing package's config ignores, asking that package about the path under it", async () => {
    const packageQuery = queryAnswering("ignored");
    const eslint = eslintGovernedBy(packageQuery);
    await expect(
      ignoredAmong({
        files: { "/repo/packages/a/eslint.config.mjs": "", "/repo/packages/a/fixtures/eslint.config.mjs": "" },
        eslint,
        packages: ["packages/a", "packages/a/fixtures"],
        candidates: ["packages/a/fixtures"],
      }),
    ).resolves.toEqual(["packages/a/fixtures"]);
    expect(vi.mocked(eslint.createQueryInstance).mock.calls).toEqual([
      [{ repoRoot: "/repo/packages/a", configFile: "/repo/packages/a/eslint.config.mjs" }],
    ]);
    expect(packageQuery.ignoredState).toHaveBeenCalledWith({ file: "fixtures/eslint.config.mjs" });
  });

  it("asks no config about a root with no eslint.config on disk, since nothing there can be loaded or skipped", async () => {
    const eslint = eslintGovernedBy(queryAnswering("ignored"));
    await expect(
      ignoredAmong({ files: { "/repo/eslint.config.mjs": "" }, eslint, packages: ["packages/web"], candidates: ["packages/web"] }),
    ).resolves.toEqual([]);
    expect(eslint.createQueryInstance).not.toHaveBeenCalled();
  });

  it("builds one query per governing config however many roots it governs", async () => {
    const eslint = eslintGovernedBy(queryAnswering("checked"));
    await ignoredAmong({
      files: { ...ROOT_AND_FIXTURE, "/repo/fixtures/other/eslint.config.mjs": "" },
      eslint,
      packages: ["fixtures/broken", "fixtures/other"],
      candidates: ["fixtures/broken", "fixtures/other"],
    });
    expect(vi.mocked(eslint.createQueryInstance).mock.calls).toEqual([[{ repoRoot: "/repo", configFile: "/repo/eslint.config.mjs" }]]);
  });
});
