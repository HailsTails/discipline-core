import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { shippedCataloguesOf } from "./shipped-catalogues.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/install");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("shippedCataloguesOf", () => {
  it("fails naming the catalogue's path when the install holds none", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(shippedCataloguesOf({ fileText, path: PATH, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/install/rules/typescript/symptoms.json", detail: "the install holds no symptom catalogue" },
    });
  });

  it("fails with the load failure when the catalogue cannot be read", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/install/rules/typescript/symptoms.json", detail: "EACCES" } }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(shippedCataloguesOf({ fileText, path: PATH, installRoot: INSTALL_ROOT })).toMatchObject({ outcome: "failed", error: { kind: "file-unreadable" } });
  });
});
