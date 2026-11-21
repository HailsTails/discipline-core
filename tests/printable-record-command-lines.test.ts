import { describe, expect, it } from "vitest";
import { RECORD_COMMAND_LINES } from "./printable-record-command-lines.ts";

const ADDRESS = "date-used-directly#clock-sources";

const FILE = "src/orders/charge-order.ts";

const HELD_IN = "hone-records/debt/date-used-directly.json";

describe("every line the version 2 record commands can print, as the contract is read against", () => {
  it("holds a line for each effect of record-debt, each reason prune-debt removes for, and each result of authorise", () => {
    expect(RECORD_COMMAND_LINES).toEqual([
      { label: "record-debt", text: `${ADDRESS} recorded ${FILE}`, fills: { address: ADDRESS, file: FILE } },
      {
        label: "record-debt",
        text: `${ADDRESS} already-recorded ${FILE}: ${HELD_IN} already holds debt on this symptom and file; the check says why it does not answer`,
        fills: { address: ADDRESS, file: FILE, "records file": HELD_IN },
      },
      {
        label: "record-debt",
        text: `${ADDRESS} left ${FILE}: under --leave src/orders; record it as an authorised location with its own reason, or fix it`,
        fills: { address: ADDRESS, file: FILE, path: "src/orders" },
      },
      {
        label: "record-debt",
        text: `${ADDRESS} touched ${FILE}: this change created or changed the file, so this run would forfeit debt on it; fix the finding there`,
        fills: { address: ADDRESS, file: FILE },
      },
      {
        label: "record-debt",
        text: `CD-99#nowhere unrecordable ${FILE}: the catalogue gives this finding no symptom or check to record debt against; fix the finding`,
        fills: { address: ADDRESS, file: FILE, clause: "CD-99#nowhere" },
      },
      { label: "prune-debt", text: `date-used-directly removed ${FILE}: paid`, fills: { address: "date-used-directly", file: FILE } },
      { label: "prune-debt", text: `date-used-directly removed ${FILE}: stale`, fills: { address: "date-used-directly", file: FILE } },
      { label: "prune-debt", text: `date-used-directly removed ${FILE}: stale, its file is no longer in the repository`, fills: { address: "date-used-directly", file: FILE } },
      { label: "prune-debt", text: `date-used-directly removed ${FILE}: stale, its file is excluded by the settings`, fills: { address: "date-used-directly", file: FILE } },
      { label: "prune-debt", text: `date-used-directly removed ${FILE}: forfeited`, fills: { address: "date-used-directly", file: FILE } },
      { label: "authorise", text: `${ADDRESS} authorised ${FILE}`, fills: { address: ADDRESS, file: FILE } },
      {
        label: "authorise",
        text: `${ADDRESS} already-authorised ${FILE}: ${HELD_IN} already holds this record`,
        fills: { address: ADDRESS, file: FILE, "records file": HELD_IN },
      },
      { label: "authorise", text: `${ADDRESS} refused ${FILE}: unknown-symptom "no-such-symptom"`, fills: { address: ADDRESS, file: FILE, given: "no-such-symptom" } },
      { label: "authorise", text: `${ADDRESS} refused ${FILE}: not-a-records-name "Not A Name"`, fills: { address: ADDRESS, file: FILE, given: "Not A Name" } },
      {
        label: "authorise",
        text: `${ADDRESS} refused ${FILE}: form-refused whyChain.rootCause: \`whyChain.rootCause\` is required: the fifth why names the cause, not another symptom`,
        fills: {
          address: ADDRESS,
          file: FILE,
          path: "whyChain.rootCause",
          message: "`whyChain.rootCause` is required: the fifth why names the cause, not another symptom",
        },
      },
    ]);
  });
});
