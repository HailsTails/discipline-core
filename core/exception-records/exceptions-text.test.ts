import { describe, expect, it } from "vitest";
import type { FileCarveOutEntry } from "./exception-record.ts";
import { exceptionsTextWith } from "./exceptions-text.ts";

const LOOPS_ENTRY: FileCarveOutEntry = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "inherited" };

const CASTS_ENTRY: FileCarveOutEntry = { kind: "file-carve-out", clause: "CD-2#cast-expressions", file: "src/b.ts", reason: "inherited" };

const NEW_FILE = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-15#loops",
      "file": "src/a.ts",
      "reason": "inherited"
    }
  ]
}
`;

const ONE_LINE_ENTRY = `{
  "version": 1,
  "exceptions": [
    { "kind": "authorised-location", "clause": "CD-17#clock-sources", "file": "src/clock.ts", "reason": "[the one clock]" }
  ]
}
`;

const ONE_LINE_ENTRY_AND_TWO_ADDED = `{
  "version": 1,
  "exceptions": [
    { "kind": "authorised-location", "clause": "CD-17#clock-sources", "file": "src/clock.ts", "reason": "[the one clock]" },
    {
      "kind": "file-carve-out",
      "clause": "CD-15#loops",
      "file": "src/a.ts",
      "reason": "inherited"
    },
    {
      "kind": "file-carve-out",
      "clause": "CD-2#cast-expressions",
      "file": "src/b.ts",
      "reason": "inherited"
    }
  ]
}
`;

const EMPTY_LIST_WITH_CRLF = '{\r\n    "version": 1,\r\n    "exceptions": []\r\n}\r\n';

const FILLED_LIST_WITH_CRLF =
  '{\r\n    "version": 1,\r\n    "exceptions": [\r\n      {\r\n        "kind": "file-carve-out",\r\n        "clause": "CD-15#loops",\r\n        "file": "src/a.ts",\r\n        "reason": "inherited"\r\n      }\r\n    ]\r\n}\r\n';

const DECOY_KEYS =
  '{"note": "a \\"[\\" {exceptions}", "exceptions_old": ["exceptions"], "version": 1, "exceptions": [{"kind": "file-carve-out", "clause": "CD-15#loops", "file": "src/z.ts", "reason": "]"}]}';

const DECOY_KEYS_AND_ONE_ADDED =
  '{"note": "a \\"[\\" {exceptions}", "exceptions_old": ["exceptions"], "version": 1, "exceptions": [{"kind": "file-carve-out", "clause": "CD-15#loops", "file": "src/z.ts", "reason": "]"},\n  {\n    "kind": "file-carve-out",\n    "clause": "CD-2#cast-expressions",\n    "file": "src/b.ts",\n    "reason": "inherited"\n  }]}';

describe("exceptionsTextWith writing entries", () => {
  it("writes a new file holding only the entries when there is none", () => {
    expect(exceptionsTextWith({ text: undefined, entries: [LOOPS_ENTRY] })).toEqual({ outcome: "ok", value: NEW_FILE });
  });

  it("appends after the last entry and keeps every byte before it as written", () => {
    expect(exceptionsTextWith({ text: ONE_LINE_ENTRY, entries: [LOOPS_ENTRY, CASTS_ENTRY] })).toEqual({
      outcome: "ok",
      value: ONE_LINE_ENTRY_AND_TWO_ADDED,
    });
  });

  it("fills an empty list, keeps the file's CRLF line breaks and the indent of its exceptions key", () => {
    expect(exceptionsTextWith({ text: EMPTY_LIST_WITH_CRLF, entries: [LOOPS_ENTRY] })).toEqual({ outcome: "ok", value: FILLED_LIST_WITH_CRLF });
  });

  it("finds the exceptions list after other keys that hold brackets, braces, escaped quotes or the word exceptions", () => {
    expect(exceptionsTextWith({ text: DECOY_KEYS, entries: [CASTS_ENTRY] })).toEqual({ outcome: "ok", value: DECOY_KEYS_AND_ONE_ADDED });
  });
});

describe("exceptionsTextWith leaving the text alone", () => {
  it("returns the text unchanged when there is nothing to add", () => {
    expect(exceptionsTextWith({ text: '{ "version": 1, "exceptions": [] }', entries: [] })).toEqual({
      outcome: "ok",
      value: '{ "version": 1, "exceptions": [] }',
    });
  });

  it("refuses text with no top-level exceptions list", () => {
    expect(exceptionsTextWith({ text: '{ "version": 1, "nested": { "exceptions": [] } }', entries: [LOOPS_ENTRY] })).toEqual({
      outcome: "failed",
      error: { detail: "holds no top-level exceptions list to add records to" },
    });
  });
});
