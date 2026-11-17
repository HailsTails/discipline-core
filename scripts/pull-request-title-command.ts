import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runPullRequestTitleCheck } from "./pull-request-title.ts";

runPullRequestTitleCheck({ process: createDefaultProcessPort({}) });
