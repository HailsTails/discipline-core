import type { Hit, NativeException } from "../mechanism-port/runner-result-schema.ts";
import type { MechanismId } from "../values/identifiers.ts";

export type Finding = Hit & { readonly mechanism: MechanismId };

export type GovernedRun = {
  readonly mechanism: MechanismId;
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
};

export type AttributedNativeException = NativeException & {
  readonly mechanism: MechanismId;
};
