import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { packageLinkOf } from "./package-link.ts";

type Read = Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;

const UNREAD: Read = { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } };

const MANIFEST: Read = { outcome: "ok", value: '{"name":"@hailstails/hone","version":"1.0.0"}' };

const OTHER_VERSION: Read = { outcome: "ok", value: '{"name":"@hailstails/hone","version":"0.9.0"}' };

const STORE_ROOT = absolutePathSchema.parse("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone");

const LINK_ROOT = "/repo/node_modules/@hailstails/hone";

const posix = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const filesReading = (request: { readonly read: FileTextPort["read"] }): FileTextPort => ({
  read: request.read,
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

const linkOver = (request: { readonly fileText: FileTextPort; readonly installRoot: string }) =>
  packageLinkOf({
    path: posix,
    fileText: request.fileText,
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse(request.installRoot),
  });

describe("packageLinkOf", () => {
  it("links the running install to the repository's node_modules entry when that entry holds the same package manifest", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue(MANIFEST);

    expect({ link: linkOver({ fileText: filesReading({ read }), installRoot: STORE_ROOT }), reads: read.mock.calls }).toEqual({
      link: { kind: "linked", installRoot: STORE_ROOT, linkRoot: LINK_ROOT },
      reads: [[{ path: `${STORE_ROOT}/package.json` }], [{ path: `${LINK_ROOT}/package.json` }]],
    });
  });

  it("links without reading when the install already runs from the repository's node_modules entry", () => {
    const read = vi.fn<FileTextPort["read"]>();

    expect({ link: linkOver({ fileText: filesReading({ read }), installRoot: LINK_ROOT }), reads: read.mock.calls }).toEqual({
      link: { kind: "linked", installRoot: LINK_ROOT, linkRoot: LINK_ROOT },
      reads: [],
    });
  });

  it("leaves the install unlinked when the repository has no node_modules entry for the package", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce(MANIFEST).mockReturnValueOnce(UNREAD);

    expect(linkOver({ fileText: filesReading({ read }), installRoot: STORE_ROOT })).toEqual({ kind: "unlinked" });
  });

  it("leaves the install unlinked when the entry holds another version", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce(MANIFEST).mockReturnValueOnce(OTHER_VERSION);

    expect(linkOver({ fileText: filesReading({ read }), installRoot: STORE_ROOT })).toEqual({ kind: "unlinked" });
  });

  it("leaves the install unlinked when the running install's manifest cannot be read", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue(UNREAD);

    expect(linkOver({ fileText: filesReading({ read }), installRoot: STORE_ROOT })).toEqual({ kind: "unlinked" });
  });
});
