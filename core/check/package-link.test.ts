import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { packageLinkOf } from "./package-link.ts";

type Read = Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;

const UNREAD: Read = { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } };

const MANIFEST: Read = { outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone", version: "1.0.0" }) };

const OTHER_VERSION: Read = { outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone", version: "0.9.0" }) };

const STORE_ROOT = absolutePathSchema.parse("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone");

const LINK_ROOT = "/repo/node_modules/@hailstails/hone";

const filesReading = (request: { readonly texts: Readonly<Record<string, Read>> }): FileTextPort => ({
  read: ({ path }) => request.texts[path] ?? UNREAD,
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

const linkFrom = (request: { readonly texts: Readonly<Record<string, Read>>; readonly installRoot: string }) =>
  packageLinkOf({
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    fileText: filesReading(request),
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse(request.installRoot),
  });

describe("packageLinkOf", () => {
  it("links the running install to the repository's node_modules entry when that entry holds the same package manifest", () => {
    expect(
      linkFrom({ installRoot: STORE_ROOT, texts: { [`${STORE_ROOT}/package.json`]: MANIFEST, [`${LINK_ROOT}/package.json`]: MANIFEST } }),
    ).toEqual({ kind: "linked", installRoot: STORE_ROOT, linkRoot: LINK_ROOT });
  });

  it("links without reading when the install already runs from the repository's node_modules entry", () => {
    const files = filesReading({ texts: {} });
    const reads = vi.spyOn(files, "read");
    const link = packageLinkOf({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
      fileText: files,
      repoRoot: absolutePathSchema.parse("/repo"),
      installRoot: absolutePathSchema.parse(LINK_ROOT),
    });

    expect({ link, reads: reads.mock.calls }).toEqual({ link: { kind: "linked", installRoot: LINK_ROOT, linkRoot: LINK_ROOT }, reads: [] });
  });

  it.each([
    { case: "the repository has no node_modules entry for the package", texts: { [`${STORE_ROOT}/package.json`]: MANIFEST } },
    {
      case: "the entry holds another version",
      texts: { [`${STORE_ROOT}/package.json`]: MANIFEST, [`${LINK_ROOT}/package.json`]: OTHER_VERSION },
    },
    { case: "the running install's manifest cannot be read", texts: { [`${LINK_ROOT}/package.json`]: MANIFEST } },
  ])("leaves the install unlinked when $case", ({ texts }) => {
    expect(linkFrom({ installRoot: STORE_ROOT, texts })).toEqual({ kind: "unlinked" });
  });
});
