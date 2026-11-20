import { recordedReachSchema } from "../../records/records-wire.ts";
import { checkAt } from "../../symptom-catalogue/check-address.ts";
import type { SymptomCatalogue } from "../../symptom-catalogue/symptom-catalogue.ts";
import { sameClauseAddress } from "../../values/clause-address.ts";
import type { RecordInput, WrittenRecord } from "../version-two-mapping/records-mapping.ts";

export type ReachBeyondEntries = { readonly symptom: string; readonly file: string };

type Reach = "within-an-entry" | "beyond-the-entries";

const reachOf = (request: { readonly written: WrittenRecord; readonly inputs: readonly RecordInput[]; readonly catalogue: SymptomCatalogue }): Reach => {
  const reach = recordedReachSchema.safeParse(request.written.symptom);
  if (!reach.success || reach.data.reaches !== "one-check") {
    return "beyond-the-entries";
  }
  const found = checkAt({ catalogue: request.catalogue, address: request.written.symptom });
  const held =
    found.found === "check" &&
    request.inputs.some(
      (input) =>
        input.kind !== "clause-wide-carve-out" && input.record.file === request.written.file && sameClauseAddress({ left: input.record.clause, right: found.check.clause }) === "same",
    );
  return held ? "within-an-entry" : "beyond-the-entries";
};

export const reachBeyondEntriesOf = (request: {
  readonly written: readonly WrittenRecord[];
  readonly inputs: readonly RecordInput[];
  readonly catalogue: SymptomCatalogue;
}): readonly ReachBeyondEntries[] =>
  request.written
    .filter((written) => reachOf({ written, inputs: request.inputs, catalogue: request.catalogue }) === "beyond-the-entries")
    .map(({ symptom, file }) => ({ symptom, file }));
