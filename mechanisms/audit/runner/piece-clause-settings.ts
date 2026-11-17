import { z } from "zod";
import type { PieceFailure } from "../../../core/mechanism-port/piece-failure-types.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import { clauseAddressText } from "../../../core/values/clause-address.ts";
import type { Result } from "../../../core/values/result.ts";

export type StringListSettings<Key extends string> = Readonly<Record<Key, readonly string[]>>;

export const stringListClauseSettings = <Key extends string>(request: {
  readonly clause: RunnerClause;
  readonly keys: readonly [Key, ...Key[]];
}): Result<StringListSettings<Key>, PieceFailure> => {
  const parsed = z
    .object({ clauseSettings: z.record(z.enum(request.keys), z.array(z.string().min(1)).readonly()) })
    .safeParse(request.clause.settings);
  if (parsed.success) return { outcome: "ok", value: parsed.data.clauseSettings };
  return {
    outcome: "failed",
    error: {
      kind: "piece-invalid",
      pieceRoot: request.clause.pieceRoot,
      detail: `the clauseSettings of ${clauseAddressText({ address: request.clause.address })} are malformed: ${z.prettifyError(parsed.error)}`,
    },
  };
};
