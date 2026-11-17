import { folderScope, type PieceFailure } from "@hailstails/hone/audit";
import { type CaseUnderTest, clauseConformanceOf, clauseUnderTestOf, repoPathOf } from "@hailstails/hone/testing";
import typescript from "typescript";
import { check } from "../mechanisms/audit/ACME-2/scratch-files.ts";

const RULE_SET_ROOT = "tools/disciplines/acme";

const provedEqual = (request: { readonly proof: string; readonly actual: unknown; readonly expected: unknown }): void => {
  if (JSON.stringify(request.actual) !== JSON.stringify(request.expected)) {
    throw new Error(`${request.proof}: expected ${JSON.stringify(request.expected)}, but got ${JSON.stringify(request.actual)}`);
  }
};

provedEqual({ proof: "a dependency folder is generated", actual: folderScope({ file: "node_modules/acme/index.js" }), expected: "generated" });
provedEqual({ proof: "a source file is authored", actual: folderScope({ file: "src/kept.ts" }), expected: "authored" });

provedEqual({
  proof: "ACME-2 reproduces its cases",
  actual: await clauseConformanceOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-2#scratch-files" }),
  expected: { outcome: "ok", value: [] },
});
provedEqual({
  proof: "ACME-1 is not an audit clause",
  actual: await clauseConformanceOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-1#console-calls" }),
  expected: { outcome: "failed", error: { kind: "rule-set-unloadable", detail: "mechanism-not-allowed acme/ACME-1#console-calls audit" } },
});

const underTest = clauseUnderTestOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-2#scratch-files" });
if (underTest.outcome === "failed") {
  throw new Error(`ACME-2 is not under test: ${underTest.error.kind} ${underTest.error.detail}`);
}
const unreadable = repoPathOf({ file: "src/locked.ts" });
if (unreadable.outcome === "failed") {
  throw new Error(`src/locked.ts is not a repository path: ${unreadable.error.detail}`);
}
const caseFiles = underTest.value.cases.map((sourceCase) => sourceCase.file);
const prepared = check.prepare({
  clauses: [underTest.value.clause],
  repository: { files: [...caseFiles, unreadable.value], exists: ({ file }) => (caseFiles.includes(file) ? "present" : "absent") },
  syntaxApi: typescript,
});
if (prepared.outcome === "failed") {
  throw new Error(`ACME-2 did not prepare: ${prepared.error.kind}`);
}

const readsOf = (sourceCase: CaseUnderTest): number => {
  const reads: string[] = [];
  prepared.value.prepareFile({
    file: sourceCase.file,
    readText: () => {
      reads.push(sourceCase.name);
      return { outcome: "ok", value: sourceCase.source };
    },
  });
  return reads.length;
};

provedEqual({
  proof: "each case is bound with its file and source, and ACME-2 decides on the file name alone",
  actual: underTest.value.cases.map((sourceCase) => ({ name: sourceCase.name, file: sourceCase.file, reads: readsOf(sourceCase) })),
  expected: [
    { name: "scratch file", file: "src/draft.scratch.ts", reads: 0 },
    { name: "ordinary file", file: "src/kept.ts", reads: 0 },
  ],
});

const unreadableFailure: PieceFailure = { kind: "file-unreadable", file: unreadable.value, detail: "EACCES" };
provedEqual({
  proof: "ACME-2 handles a file it cannot read",
  actual: prepared.value.prepareFile({ file: unreadable.value, readText: () => ({ outcome: "failed", error: unreadableFailure }) }),
  expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
});
