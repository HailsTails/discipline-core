import { describe, expect, it } from "vitest";
import {
  isChecksRunFailureAgreed,
  isMisnamedRuleIdAgreed,
  isNotReadyYetFailureAgreed,
  isNotReadyYetFailureAReportedLoadFailure,
  isProjectionStateAgreed,
} from "./checks-core-agreement.ts";

describe("the runner's local copies of what core defines", () => {
  it("agrees with core on the failure, the misnamed id and the projection state the runner reports, checked where the types are compared", () => {
    expect([isNotReadyYetFailureAgreed, isChecksRunFailureAgreed, isMisnamedRuleIdAgreed, isProjectionStateAgreed, isNotReadyYetFailureAReportedLoadFailure]).toEqual([true, true, true, true, true]);
  });
});
