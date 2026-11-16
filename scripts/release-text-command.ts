import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { TOOL_IDENTITY } from "../core/values/tool-identity.ts";
import { runReleaseText } from "./release-text.ts";

runReleaseText({ process: createDefaultProcessPort({}), identity: TOOL_IDENTITY });
