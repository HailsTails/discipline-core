import { describe, expect, it } from "vitest";
import { SETTINGS_FILE_NAME as CORE_SETTINGS_FILE_NAME } from "../core/settings/settings-sources.ts";
import { SETTINGS_FILE_NAME } from "../mechanisms/eslint/runner/checks-nested-repositories.ts";
import {
  isChecksRunFailureAgreed,
  isMisnamedRuleIdAgreed,
  isNotReadyYetFailureAgreed,
  isNotReadyYetFailureAReportedLoadFailure,
  isProjectionStateAgreed,
} from "./checks-core-agreement.ts";

describe("the runner's local copies of what core defines", () => {
  it("names the version 2 settings file as core does", () => {
    expect(SETTINGS_FILE_NAME).toBe(CORE_SETTINGS_FILE_NAME);
  });

  it("agrees with core on the failure, the misnamed id and the projection state the runner reports, checked where the types are compared", () => {
    expect([isNotReadyYetFailureAgreed, isChecksRunFailureAgreed, isMisnamedRuleIdAgreed, isProjectionStateAgreed, isNotReadyYetFailureAReportedLoadFailure]).toEqual([true, true, true, true, true]);
  });
});
