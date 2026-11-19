import { describe, expect, it } from "vitest";
import { syntaxNodeOf } from "./syntax-node-of.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const SYNTAX_API = defaultParsePort.syntaxApi;

describe("syntaxNodeOf", () => {
  it("finds the node of the kind that starts where the text does", () => {
    expect(
      syntaxNodeOf({
        syntaxApi: SYNTAX_API,
        source: "const port = { isFile: (path) => files.includes(path) };",
        text: "files.includes",
        kind: SYNTAX_API.SyntaxKind.CallExpression,
      }),
    ).toMatchObject({ kind: SYNTAX_API.SyntaxKind.CallExpression, end: 53 });
  });

  it("finds the outermost such node when several start at the text", () => {
    expect(
      syntaxNodeOf({ syntaxApi: SYNTAX_API, source: "a.b.c();", text: "a.b", kind: SYNTAX_API.SyntaxKind.PropertyAccessExpression }),
    ).toMatchObject({ end: 5 });
  });

  it("finds nothing when no node of the kind starts at the text", () => {
    expect(
      syntaxNodeOf({ syntaxApi: SYNTAX_API, source: "a.b();", text: "a.b", kind: SYNTAX_API.SyntaxKind.IfStatement }),
    ).toBeUndefined();
  });
});
