import { assert, describe, expect, it, vi } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import { AUDIT, CAST_EXPRESSIONS, CLOCK_SOURCES, DATE_USED_DIRECTLY, ESLINT, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "../../tests/report-catalogue.ts";
import type { Finding } from "../governance/governance.ts";
import type { GitPort, GitTreePort } from "../platform-ports/git-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { PlacedRecord, RecordsDocument } from "./hone-record.ts";
import { authoriseOf, pruneDebtOf, recordDebtOf } from "./record-commands.ts";
import type { RecordsSource } from "./records-source.ts";
import type { RecordsStore } from "./records-store.ts";

const REPO_ROOT = absolutePathSchema.parse("/work/shop");

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const NEW_FILE = repoPathSchema.parse("src/orders/refund-order.ts");

const TOUCHED_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "chargedAt" };

const NEW_FILE_FINDING: Finding = { ...CLOCK_FINDING, file: NEW_FILE };

const TOUCHED_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: TOUCHED_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" };

const OK = { outcome: "ok", value: undefined } as const;

const DEBT_DOCUMENT: RecordsDocument = {
  file: DEBT_FILE,
  document: { version: 2, records: [{ symptom: "date-used-directly#clock-sources", file: ORDER_FILE }] },
};

const sourceOf = (request: { readonly documents: readonly RecordsDocument[] }): RecordsSource => ({
  read: () => ({ outcome: "ok", value: request.documents }),
  readAt: () => ({ outcome: "ok", value: [] }),
});

const storeOf = () => {
  const apply = vi.fn<RecordsStore["apply"]>().mockReturnValue(OK);
  return { apply, store: { apply } };
};

type GitStubs = { readonly gitTree: GitTreePort; readonly git: Pick<GitPort, "changedSince"> };

const ORDER_UNCHANGED: GitStubs = {
  gitTree: { pathsAt: () => ({ outcome: "ok", value: [ORDER_FILE] }) },
  git: { changedSince: () => ({ outcome: "ok", value: [] }) },
};

const WEBHOOK_CHANGED: GitStubs = {
  gitTree: { pathsAt: () => ({ outcome: "ok", value: [ORDER_FILE, TOUCHED_FILE] }) },
  git: { changedSince: () => ({ outcome: "ok", value: [TOUCHED_FILE] }) },
};

const COMMAND = { catalogue: REPORT_CATALOGUE, repoRoot: REPO_ROOT };

describe("hone record-debt over a run's unanswered findings", () => {
  const request = { findings: [CLOCK_FINDING], baseRevision: "origin/main", leave: [] };

  it("writes one debt record under hone-records/debt for the symptom and check, in the format the records reader reads", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store, ...ORDER_UNCHANGED })(request);
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "recorded" }] });
    expect(apply).toHaveBeenCalledWith({
      edit: { write: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "date-used-directly#clock-sources", file: ORDER_FILE }] } }], remove: [] },
    });
  });

  it("writes nothing the second time, when the first run's records are held", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store, ...ORDER_UNCHANGED })(request);
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE }] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing for a file the base lacks or this change changed, and says so", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ...COMMAND,
      source: sourceOf({ documents: [] }),
      store,
      ...WEBHOOK_CHANGED,
    })({ ...request, findings: [NEW_FILE_FINDING, TOUCHED_FINDING] });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        { address: "claimed-type#cast-expressions", file: TOUCHED_FILE, effect: "touched" },
        { address: "date-used-directly#clock-sources", file: NEW_FILE, effect: "new-file" },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing and prints nothing when the run left nothing unanswered", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store, ...ORDER_UNCHANGED })({ ...request, findings: [] })).toEqual({ outcome: "ok", value: [] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails with git's own words when the base cannot be read", () => {
    const { store } = storeOf();
    const gitTree: GitTreePort = { pathsAt: () => ({ outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "bad revision" } }) };
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store, gitTree, git: ORDER_UNCHANGED.git })(request)).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-tree: bad revision" },
    });
  });

  it("fails, without writing, when hone-records holds a file it cannot read as records", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ...COMMAND,
      source: sourceOf({ documents: [{ file: DEBT_FILE, document: { records: [] } }] }),
      store,
      ...ORDER_UNCHANGED,
    })(request);
    expect(recorded).toMatchObject({ outcome: "failed", error: { kind: "records-documents" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("passes on the failure of the store that could not write", () => {
    const { apply, store } = storeOf();
    apply.mockReturnValue({ outcome: "failed", error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt/date-used-directly.json", detail: "EACCES" } });
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store, ...ORDER_UNCHANGED })(request)).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt/date-used-directly.json", detail: "EACCES" },
    });
  });
});

const PAID_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

describe("hone prune-debt over a run's paid, stale and forfeited debt", () => {
  it("removes exactly the debt the report listed, from the document that holds it", () => {
    const { apply, store } = storeOf();
    const pruned = pruneDebtOf({ source: sourceOf({ documents: [DEBT_DOCUMENT] }), store })({ report: { paid: [{ debt: PAID_DEBT, answeredBy: [] }], stale: [], forfeited: [] } });
    expect(pruned).toMatchObject({ outcome: "ok", value: [{ place: { file: DEBT_FILE, index: 0 }, reason: "paid" }] });
    expect(apply).toHaveBeenCalledWith({ edit: { write: [], remove: [DEBT_FILE] } });
  });

  it("writes nothing when the report lists nothing to remove", () => {
    const { apply, store } = storeOf();
    expect(pruneDebtOf({ source: sourceOf({ documents: [DEBT_DOCUMENT] }), store })({ report: { paid: [], stale: [], forfeited: [] } })).toEqual({ outcome: "ok", value: [] });
    expect(apply).not.toHaveBeenCalled();
  });
});

const AUTHORISE = {
  symptom: "claimed-type",
  file: TOUCHED_FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootCheck: CAUSAL_WHY_CHAIN.rootCheck,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

describe("hone authorise over the person's arguments", () => {
  it("writes the one record when the form accepts it", () => {
    const { apply, store } = storeOf();
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store })(AUTHORISE)).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the form refuses the chain", () => {
    const { apply, store } = storeOf();
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store })({ ...AUTHORISE, rootCause: "no" })).toMatchObject({ outcome: "ok", value: { judged: "refused" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing for a record already held", () => {
    const first = storeOf();
    authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store: first.store })(AUTHORISE);
    const { apply, store } = storeOf();
    const [firstCall] = first.apply.mock.calls;
    assert(firstCall !== undefined, "the first authorise wrote its record");
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: firstCall[0].edit.write }), store })(AUTHORISE)).toMatchObject({ outcome: "ok", value: { judged: "already-held" } });
    expect(apply).not.toHaveBeenCalled();
  });
});
