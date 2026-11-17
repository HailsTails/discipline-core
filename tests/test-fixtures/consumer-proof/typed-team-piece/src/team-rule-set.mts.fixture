import type { DisciplineFile, EslintPieceSettings, PieceFile } from "@hailstails/hone/rule-set";

export const discipline: DisciplineFile = {
  version: 1,
  id: "TEAM-1",
  clauses: [
    {
      kind: "mechanical",
      id: "no-debugger",
      summary: "Debugger statements do not ship.",
      mechanisms: ["audit"],
      anchor: { kind: "keyword", keyword: "debugger" },
      cases: {
        flag: [{ name: "a debugger statement", fileName: "src/flagged.ts", source: "debugger;\n", expectedLines: [1] }],
        allow: [{ name: "no debugger", fileName: "src/allowed.ts", source: "export {};\n", expectedLines: [] }],
      },
    },
    { kind: "judgement", id: "named-intent", summary: "Names say what they hold.", enforcedBy: "review" },
  ],
};

export const auditPiece: PieceFile = { version: 1, discipline: "TEAM-1", mechanism: "audit", clauses: [{ clause: "no-debugger", settings: {} }] };

const eslintSettings: EslintPieceSettings = { pluginNamespace: "team", pluginModule: "team/plugin.ts", rule: "no-debugger", options: [{ severity: "high" }] };

export const eslintPiece: PieceFile = { version: 1, discipline: "TEAM-1", mechanism: "eslint", clauses: [{ clause: "no-debugger", settings: eslintSettings }] };
