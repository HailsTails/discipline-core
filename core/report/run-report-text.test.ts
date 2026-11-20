import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import {
  AUDIT,
  CAST_CHECK,
  CAST_EXPRESSIONS,
  CLAIMED_TYPE,
  CLOCK_CHECK,
  CLOCK_SOURCES,
  DATE_USED_DIRECTLY,
  ESLINT,
  ESLINT_ENGINE,
  GIVES_A_VALUE_ITS_TYPE,
  REPORT_CATALOGUE,
  SYMPTOM_PAGE,
  TEST_BODY_CHECK,
  WALKER,
} from "../../tests/report-catalogue.ts";
import type { Finding } from "../governance/governance.ts";
import type { PlacedRecord } from "../records/hone-record.ts";
import { editionSchema } from "../values/edition.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { RunReport } from "./run-report.ts";
import { renderRunReportText } from "./run-report-text.ts";

const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "clock.now()" };

const CAST_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: WEBHOOK_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" };

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, file: WEBHOOK_FILE, holding: { held: "stated" } },
};

const NOTED_LOCATION: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    file: WEBHOOK_FILE,
    holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" } }, whyChain: CAUSAL_WHY_CHAIN },
  },
};

const EMPTY_REPORT: RunReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  refused: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  notes: [],
  carried: [],
  symptoms: [],
};

const EVERY_SECTION: RunReport = {
  excluded: [repoPathSchema.parse("dist")],
  notAdopted: [CAST_CHECK],
  notRun: [TEST_BODY_CHECK],
  editions: [{ check: CLOCK_CHECK, engine: WALKER, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }],
  findings: [CLOCK_FINDING],
  answered: [{ finding: CAST_FINDING, by: [NOTED_LOCATION] }],
  uncovered: [CLOCK_CHECK],
  stale: [NOTED_LOCATION],
  forfeited: [DEBT],
  unrecorded: [{ kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT }],
  doublyHeld: [{ debt: DEBT, alsoHeldBy: [NOTED_LOCATION] }],
  refused: [{ place: { file: AUTHORISED_FILE, index: 1 }, refusals: [{ kind: "carried-changed-since-base" }] }],
  unmeasured: [{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }],
  projectionProblems: [{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }],
  assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 2 }],
  notes: [{ kind: "declared-not-read", key: "layers" }],
  carried: [{ place: { file: AUTHORISED_FILE, index: 2 }, lacks: ["case"], standing: "established" }],
  symptoms: [DATE_USED_DIRECTLY],
};

const NOTE = 'note: gives-a-value-its-type does not owe "written-out-answers"';

const LINES = {
  excluded: "dist",
  notAdopted: "claimed-type#cast-expressions",
  notRun: "branch-in-a-test#test-body adopted, engine not run: enforced by review",
  editions: "date-used-directly#clock-sources walker edition 1 of 2",
  findings: "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 clock.now() may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
  answered: `claimed-type#cast-expressions eslint src/adapters/stripe-webhook.ts:4:9 body as Event answered by authorised-location ${NOTE}`,
  uncovered: "date-used-directly#clock-sources",
  stale: `claimed-type authorised-location src/adapters/stripe-webhook.ts ${NOTE}`,
  forfeited: "claimed-type debt src/adapters/stripe-webhook.ts",
  unrecorded: "claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts",
  doublyHeld: `claimed-type debt src/adapters/stripe-webhook.ts also held by authorised-location ${NOTE}`,
  refused: "hone-records/authorised-locations/claimed-type.json records[1] carried-changed-since-base",
  unmeasured:
    'forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere',
  projectionProblems: `eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run ${PROJECT_COMMAND} and commit every hone.eslint.mjs it writes`,
  assessment: "forfeiture elsewhere: 2 debt records not checked for forfeiture in this run",
  notes: "layers is declared; no check reads it yet",
  carried: "hone-records/authorised-locations/claimed-type.json records[2] established lacks case",
  symptoms: `date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter. Known debt: debt. Read ${SYMPTOM_PAGE}#date-used-directly`,
};

const rendered = (request: { readonly report: RunReport; readonly output: ReportOutput }): string =>
  renderRunReportText({ ...request, catalogue: REPORT_CATALOGUE, symptomPage: SYMPTOM_PAGE, projectCommand: PROJECT_COMMAND });

describe("renderRunReportText", () => {
  it("prints only the verdict for a run with nothing to report", () => {
    expect(rendered({ report: EMPTY_REPORT, output: "full" })).toBe("verdict: pass\n");
  });

  it("prints every non-empty section in order, each headed by its count, then the verdict", () => {
    expect(rendered({ report: EVERY_SECTION, output: "full" })).toBe(
      `excluded (1)\n${LINES.excluded}\nnotAdopted (1)\n${LINES.notAdopted}\nnotRun (1)\n${LINES.notRun}\neditions (1)\n${LINES.editions}\nfindings (1)\n${LINES.findings}\nanswered (1)\n${LINES.answered}\nuncovered (1)\n${LINES.uncovered}\nstale (1)\n${LINES.stale}\nforfeited (1)\n${LINES.forfeited}\nunrecorded (1)\n${LINES.unrecorded}\ndoublyHeld (1)\n${LINES.doublyHeld}\nrefused (1)\n${LINES.refused}\nunmeasured (1)\n${LINES.unmeasured}\nprojectionProblems (1)\n${LINES.projectionProblems}\nassessment (1)\n${LINES.assessment}\nnotes (1)\n${LINES.notes}\ncarried (1)\n${LINES.carried}\nsymptoms (1)\n${LINES.symptoms}\nverdict: fail (partial assessment)\n`,
    );
  });

  it("leaves out the informational sections when it prints failures only", () => {
    expect(rendered({ report: EVERY_SECTION, output: "failures-only" })).toBe(
      `findings (1)\n${LINES.findings}\nuncovered (1)\n${LINES.uncovered}\nstale (1)\n${LINES.stale}\nforfeited (1)\n${LINES.forfeited}\nunrecorded (1)\n${LINES.unrecorded}\ndoublyHeld (1)\n${LINES.doublyHeld}\nrefused (1)\n${LINES.refused}\nunmeasured (1)\n${LINES.unmeasured}\nprojectionProblems (1)\n${LINES.projectionProblems}\nsymptoms (1)\n${LINES.symptoms}\nverdict: fail (partial assessment)\n`,
    );
  });

  it("prints each section's heading alone, naming the role of each that does not fail the run, when it prints counts", () => {
    expect(rendered({ report: EVERY_SECTION, output: "counts" })).toBe(
      `excluded (1) informational\nnotAdopted (1) informational\nnotRun (1) informational\neditions (1) informational\nfindings (1)\nanswered (1) informational\nuncovered (1)\nstale (1)\nforfeited (1)\nunrecorded (1)\ndoublyHeld (1)\nrefused (1)\nunmeasured (1)\nprojectionProblems (1)\nassessment (1) informational\nnotes (1) informational\ncarried (1) informational\nsymptoms (1) guidance\nverdict: fail (partial assessment)\n`,
    );
  });

  it("prints the verdict alone when it prints the verdict only", () => {
    expect(rendered({ report: EVERY_SECTION, output: "verdict-only" })).toBe("verdict: fail (partial assessment)\n");
  });

  it("passes a run whose answered finding carries a catalogue note, with its notes, carried records and symptoms", () => {
    expect(
      rendered({
        report: { ...EMPTY_REPORT, answered: EVERY_SECTION.answered, notes: EVERY_SECTION.notes, carried: EVERY_SECTION.carried, symptoms: EVERY_SECTION.symptoms },
        output: "verdict-only",
      }),
    ).toBe("verdict: pass\n");
  });

  it("passes a run with a partial assessment and says so", () => {
    expect(rendered({ report: { ...EMPTY_REPORT, assessment: EVERY_SECTION.assessment }, output: "verdict-only" })).toBe("verdict: pass (partial assessment)\n");
  });

  it("fails a run with a refused record and nothing else", () => {
    expect(rendered({ report: { ...EMPTY_REPORT, refused: EVERY_SECTION.refused }, output: "verdict-only" })).toBe("verdict: fail\n");
  });
});
